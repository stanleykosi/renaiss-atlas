import { freshnessLabel } from "@renaiss/core";
import {
  createDbClient,
  DatabaseEnvSchema,
  demoCards,
  demoExternalPrices,
  demoLatestPrices,
  demoLatestScores,
  sourceRecords,
  cards as cardsTable,
  latestCardPrices,
  latestScores,
  externalPriceSnapshots,
  syncRuns
} from "@renaiss/db";

import { applyMarketFilters, defaultMarketFilters } from "@/lib/market-filters";
import type {
  CardDetailResponse,
  CardListResponse,
  CardStatus,
  ConfidenceLabel,
  DataSourceMode,
  MarketCard,
  MarketExternalComp,
  MarketFilters,
  MarketHealth,
  MarketOverview,
  SyncStatus
} from "@/lib/market-types";

const MARKET_STALE_AFTER_MS = 1000 * 60 * 60 * 48;

type DbRows = {
  cards: Array<typeof cardsTable.$inferSelect>;
  prices: Array<typeof latestCardPrices.$inferSelect>;
  scores: Array<typeof latestScores.$inferSelect>;
  externalComps: Array<typeof externalPriceSnapshots.$inferSelect>;
  sourceRecords: Array<typeof sourceRecords.$inferSelect>;
  syncRuns: Array<typeof syncRuns.$inferSelect>;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function freshnessFor(observedAt: string | null, now: Date) {
  return freshnessLabel({
    source: "renaiss_marketplace_v0",
    observedAt,
    now,
    staleAfterMs: MARKET_STALE_AFTER_MS
  }).status;
}

function confidenceFromScores(scores: {
  liquidityScore: number | null;
  dealScore: number | null;
  priceConfidenceScore: number | null;
}): ConfidenceLabel {
  const values = [scores.liquidityScore, scores.dealScore, scores.priceConfidenceScore].filter(
    (value): value is number => value != null
  );
  if (values.some((value) => value >= 75)) return "high";
  if (values.some((value) => value >= 45)) return "medium";
  return "low";
}

function dealDelta(askPriceUsd: number | null, fmvUsd: number | null): number | null {
  if (askPriceUsd == null || fmvUsd == null || fmvUsd <= 0) return null;
  return ((fmvUsd - askPriceUsd) / fmvUsd) * 100;
}

function sourceLabel(sourceMode: DataSourceMode, mockData: boolean) {
  if (sourceMode === "seed") return "Seed fixtures";
  return mockData ? "Mock database seed" : "Postgres";
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => value != null && value.length > 0))].sort(
    (left, right) => left.localeCompare(right, undefined, { numeric: true })
  );
}

function buildMarketCards(input: {
  sourceMode: DataSourceMode;
  cards: Array<{
    tokenId: string;
    itemId?: string | null;
    name: string;
    setName?: string | null;
    cardNumber?: string | null;
    characterName?: string | null;
    tcg?: string | null;
    ownerAddress?: string | null;
    ownerUsername?: string | null;
    grader?: string | null;
    grade?: string | null;
    language?: string | null;
    year?: number | null;
    serial?: string | null;
    serialNum?: bigint | null;
    imageUrl?: string | null;
    status: CardStatus;
    lastSeenAt?: Date | string | null;
    lastSourceRecordId?: string | null;
    metadata?: unknown;
  }>;
  prices: Array<{
    tokenId: string;
    askPriceUsd?: string | number | null;
    fmvUsd?: string | number | null;
    offerPriceUsd?: string | number | null;
    topOfferUsd?: string | number | null;
    lastSaleUsd?: string | number | null;
    buybackBaseValueUsd?: string | number | null;
    isListed: boolean;
    observedAt?: Date | string | null;
    priceSnapshotId?: string | null;
  }>;
  scores: Array<{
    entityId: string;
    scoreType: string;
    scoreValue: string | number;
    confidence: string;
  }>;
  externalComps: Array<{
    id?: string;
    tokenId: string;
    platform: string;
    productTitle?: string | null;
    currentPriceUsd?: string | number | null;
    averagePriceUsd?: string | number | null;
    matchConfidence?: string | number | null;
    rejected: boolean;
    rejectionReason?: string | null;
    fetchedAt?: Date | string | null;
  }>;
  now: Date;
}) {
  const priceByToken = new Map(input.prices.map((price) => [price.tokenId, price]));
  const scoreByTokenAndType = new Map(
    input.scores.map((score) => [`${score.entityId}:${score.scoreType}`, score])
  );
  const compsByToken = new Map<string, MarketExternalComp[]>();

  for (const comp of input.externalComps) {
    const current = compsByToken.get(comp.tokenId) ?? [];
    current.push({
      id: comp.id ?? `${comp.tokenId}:${comp.platform}`,
      platform: comp.platform,
      productTitle: comp.productTitle ?? null,
      currentPriceUsd: toNumber(comp.currentPriceUsd),
      averagePriceUsd: toNumber(comp.averagePriceUsd),
      matchConfidence: toNumber(comp.matchConfidence) ?? 0,
      rejected: comp.rejected,
      rejectionReason: comp.rejectionReason ?? null,
      fetchedAt: toIso(comp.fetchedAt) ?? input.now.toISOString()
    });
    compsByToken.set(comp.tokenId, current);
  }

  return input.cards.map((card): MarketCard => {
    const price = priceByToken.get(card.tokenId);
    const liquidityScore = toNumber(scoreByTokenAndType.get(`${card.tokenId}:liquidity`)?.scoreValue);
    const dealScore = toNumber(scoreByTokenAndType.get(`${card.tokenId}:deal`)?.scoreValue);
    const priceConfidenceScore = toNumber(
      scoreByTokenAndType.get(`${card.tokenId}:price_confidence`)?.scoreValue
    );
    const externalCompConfidenceScore = toNumber(
      scoreByTokenAndType.get(`${card.tokenId}:external_comp_confidence`)?.scoreValue
    );
    const askPriceUsd = toNumber(price?.askPriceUsd);
    const fmvUsd = toNumber(price?.fmvUsd);
    const metadata = toRecord(card.metadata);
    const mockData = metadata["mockData"] === true || input.sourceMode === "seed";
    const observedAt = toIso(price?.observedAt ?? card.lastSeenAt);
    const riskFlags = [
      ...(mockData ? ["mock_data"] : []),
      ...(price?.isListed === true && askPriceUsd == null ? ["listed_without_ask"] : []),
      ...((compsByToken.get(card.tokenId) ?? []).some((comp) => comp.rejected)
        ? ["external_comp_mismatch"]
        : [])
    ];

    const scores = { liquidityScore, dealScore, priceConfidenceScore };

    return {
      tokenId: card.tokenId,
      itemId: card.itemId ?? null,
      name: card.name,
      setName: card.setName ?? "",
      cardNumber: card.cardNumber ?? "",
      characterName: card.characterName ?? "",
      tcg: card.tcg ?? "",
      ownerAddress: card.ownerAddress ?? null,
      ownerUsername: card.ownerUsername ?? null,
      grader: card.grader ?? null,
      grade: card.grade ?? null,
      language: card.language ?? null,
      year: card.year ?? null,
      serial: card.serial ?? null,
      serialNum: card.serialNum == null ? null : String(card.serialNum),
      imageUrl: card.imageUrl ?? null,
      status: card.status,
      askPriceUsd,
      fmvUsd,
      offerPriceUsd: toNumber(price?.offerPriceUsd),
      topOfferUsd: toNumber(price?.topOfferUsd),
      lastSaleUsd: toNumber(price?.lastSaleUsd),
      buybackBaseValueUsd: toNumber(price?.buybackBaseValueUsd),
      liquidityScore,
      dealScore,
      priceConfidenceScore,
      externalCompConfidenceScore,
      confidence: confidenceFromScores(scores),
      dealDeltaPct: dealDelta(askPriceUsd, fmvUsd),
      observedAt,
      freshness: freshnessFor(observedAt, input.now),
      sourceLabel: sourceLabel(input.sourceMode, mockData),
      sourceIds: [card.lastSourceRecordId, price?.priceSnapshotId].filter(
        (value): value is string => value != null && value.length > 0
      ),
      riskFlags,
      mockData,
      demoCase: typeof metadata["demoCase"] === "string" ? metadata["demoCase"] : null,
      externalComps: compsByToken.get(card.tokenId) ?? []
    };
  });
}

function buildMarketHealth(cards: readonly MarketCard[], sourceMode: DataSourceMode, now: Date): MarketHealth {
  const lastObservedAt =
    cards
      .map((card) => card.observedAt)
      .filter((value): value is string => value != null)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
  const liquidityValues = cards
    .map((card) => card.liquidityScore)
    .filter((value): value is number => value != null);
  const listedCards = cards.filter((card) => card.status === "listed").length;

  return {
    totalCards: cards.length,
    listedCards,
    unlistedCards: cards.filter((card) => card.status === "unlisted").length,
    totalAskUsd: cards.reduce((sum, card) => sum + (card.askPriceUsd ?? 0), 0),
    totalFmvUsd: cards.reduce((sum, card) => sum + (card.fmvUsd ?? 0), 0),
    averageLiquidityScore:
      liquidityValues.length === 0
        ? null
        : liquidityValues.reduce((sum, score) => sum + score, 0) / liquidityValues.length,
    underFmvCount: cards.filter((card) => card.dealDeltaPct != null && card.dealDeltaPct > 0).length,
    externalMismatchCount: cards.filter((card) =>
      card.externalComps.some((comp) => comp.rejected)
    ).length,
    staleCards: cards.filter((card) => card.freshness === "stale").length,
    lastObservedAt,
    freshness: freshnessFor(lastObservedAt, now),
    sourceMode,
    sourceLabel: sourceLabel(sourceMode, sourceMode === "seed"),
    mockData: cards.some((card) => card.mockData)
  };
}

function buildSyncStatus(input: {
  sourceMode: DataSourceMode;
  sourceRows: Array<{ source: string; fetchedAt: Date | string }>;
  syncRuns: Array<{
    id: string;
    jobName: string;
    source: string | null;
    status: string;
    startedAt: Date | string;
    finishedAt: Date | string | null;
    recordsSeen: number;
    recordsFailed: number;
  }>;
  cards: readonly MarketCard[];
  now: Date;
}): SyncStatus {
  const latestRun = [...input.syncRuns].sort(
    (left, right) => Date.parse(String(right.startedAt)) - Date.parse(String(left.startedAt))
  )[0];
  const sourceRows = input.sourceRows.length > 0 ? input.sourceRows : [];
  const freshestSource = sourceRows
    .map((row) => ({ source: row.source, fetchedAt: toIso(row.fetchedAt) }))
    .filter((row): row is { source: string; fetchedAt: string } => row.fetchedAt != null)
    .sort((left, right) => Date.parse(right.fetchedAt) - Date.parse(left.fetchedAt))[0];
  const lastObservedAt =
    freshestSource?.fetchedAt ??
    input.cards
      .map((card) => card.observedAt)
      .filter((value): value is string => value != null)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ??
    null;
  const source = freshestSource?.source ?? (input.sourceMode === "seed" ? "manual_seed" : "postgres");
  const freshness = freshnessLabel({
    source,
    observedAt: lastObservedAt ?? null,
    now: input.now,
    staleAfterMs: MARKET_STALE_AFTER_MS
  });
  const freshnessEntry: SyncStatus["freshness"][number] = {
    source: String(freshness.source),
    status: freshness.status
  };
  if (freshness.observedAt != null) {
    freshnessEntry.observedAt = freshness.observedAt;
  }
  if (freshness.message != null) {
    freshnessEntry.message = freshness.message;
  }

  return {
    sourceMode: input.sourceMode,
    generatedAt: input.now.toISOString(),
    latestRun:
      latestRun == null
        ? null
        : {
            id: latestRun.id,
            jobName: latestRun.jobName,
            source: latestRun.source,
            status: latestRun.status,
            startedAt: toIso(latestRun.startedAt) ?? input.now.toISOString(),
            finishedAt: toIso(latestRun.finishedAt),
            recordsSeen: latestRun.recordsSeen,
            recordsFailed: latestRun.recordsFailed
          },
    freshness: [freshnessEntry]
  };
}

function seedRows(now: Date): MarketOverview {
  const prices = demoLatestPrices.map((price) => ({
    tokenId: price.tokenId,
    priceSnapshotId: price.priceSnapshotId,
    askPriceUsd: price.askPriceUsd ?? null,
    fmvUsd: price.fmvUsd ?? null,
    offerPriceUsd: price.offerPriceUsd ?? null,
    topOfferUsd: price.topOfferUsd ?? null,
    lastSaleUsd: price.lastSaleUsd ?? null,
    buybackBaseValueUsd: price.buybackBaseValueUsd ?? null,
    isListed: price.isListed,
    observedAt: price.observedAt
  }));
  const cards = buildMarketCards({
    sourceMode: "seed",
    cards: demoCards,
    prices,
    scores: demoLatestScores,
    externalComps: demoExternalPrices,
    now
  });
  const syncStatus = buildSyncStatus({
    sourceMode: "seed",
    sourceRows: [],
    syncRuns: [],
    cards,
    now
  });

  return {
    sourceMode: "seed",
    generatedAt: now.toISOString(),
    cards,
    health: buildMarketHealth(cards, "seed", now),
    syncStatus,
    filters: {
      languages: unique(cards.map((card) => card.language)),
      graders: unique(cards.map((card) => card.grader)),
      grades: unique(cards.map((card) => card.grade)),
      statuses: ["listed", "unlisted", "unknown"]
    }
  };
}

function shouldUseSeedData(): boolean {
  return process.env["DEMO_MODE"] !== "false" || process.env["DATABASE_URL"] == null;
}

async function readDbRows(): Promise<DbRows | null> {
  const env = DatabaseEnvSchema.safeParse(process.env);
  if (!env.success) return null;

  const database = createDbClient(env.data.DATABASE_URL, {
    databaseSsl: env.data.DATABASE_SSL,
    max: 1
  });

  try {
    const [cards, prices, scores, externalComps, sourceRows, runRows] = await Promise.all([
      database.db.select().from(cardsTable),
      database.db.select().from(latestCardPrices),
      database.db.select().from(latestScores),
      database.db.select().from(externalPriceSnapshots),
      database.db.select().from(sourceRecords),
      database.db.select().from(syncRuns)
    ]);

    return {
      cards,
      prices,
      scores,
      externalComps,
      sourceRecords: sourceRows,
      syncRuns: runRows
    };
  } catch {
    return null;
  } finally {
    await database.close();
  }
}

export async function getMarketOverview(): Promise<MarketOverview> {
  const now = new Date();

  if (shouldUseSeedData()) {
    return seedRows(now);
  }

  const dbRows = await readDbRows();
  if (dbRows == null || dbRows.cards.length === 0) {
    return seedRows(now);
  }

  const cards = buildMarketCards({
    sourceMode: "database",
    cards: dbRows.cards,
    prices: dbRows.prices,
    scores: dbRows.scores,
    externalComps: dbRows.externalComps,
    now
  });
  const syncStatus = buildSyncStatus({
    sourceMode: "database",
    sourceRows: dbRows.sourceRecords,
    syncRuns: dbRows.syncRuns,
    cards,
    now
  });

  return {
    sourceMode: "database",
    generatedAt: now.toISOString(),
    cards,
    health: buildMarketHealth(cards, "database", now),
    syncStatus,
    filters: {
      languages: unique(cards.map((card) => card.language)),
      graders: unique(cards.map((card) => card.grader)),
      grades: unique(cards.map((card) => card.grade)),
      statuses: ["listed", "unlisted", "unknown"]
    }
  };
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return (await getMarketOverview()).syncStatus;
}

export async function getMarketHealth(): Promise<MarketHealth> {
  return (await getMarketOverview()).health;
}

export async function listMarketCards(input: {
  filters?: Partial<MarketFilters>;
  page?: number;
  pageSize?: number;
}): Promise<CardListResponse> {
  const overview = await getMarketOverview();
  const filters = { ...defaultMarketFilters, ...input.filters };
  const filtered = applyMarketFilters(overview.cards, filters);
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 50));
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    page,
    pageSize,
    total: filtered.length,
    freshness: overview.syncStatus.freshness
  };
}

export async function getCardDetail(tokenId: string): Promise<CardDetailResponse | null> {
  const overview = await getMarketOverview();
  const item = overview.cards.find((card) => card.tokenId === tokenId);
  if (item == null) return null;

  return {
    item,
    freshness: overview.syncStatus.freshness
  };
}
