import {
  freshnessLabel,
  matchIntentsToCards,
  scoreCard,
  type DeterministicCardScoringInput,
  type DeterministicStoredScore,
  type IntentMatchingCardInput,
  type IntentMatchingIntentInput,
  type IntentMatchResult,
  type StoredCardScoreType
} from "@renaiss/core";
import {
  bundleItems,
  bundles,
  createDbClient,
  DatabaseEnvSchema,
  demoBundleItems,
  demoBundles,
  demoCards,
  demoExternalPrices,
  demoIntents,
  demoIntentMatches,
  demoLatestPrices,
  demoPackActivities,
  demoScores,
  sourceRecords,
  cards as cardsTable,
  externalPriceSnapshots,
  intentMatches,
  intents as intentsTable,
  latestCardPrices,
  packActivities,
  scores as scoresTable,
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
  MarketScore,
  SyncStatus
} from "@/lib/market-types";

const MARKET_STALE_AFTER_MS = 1000 * 60 * 60 * 48;
const CARD_SCORE_TYPES = [
  "activity_velocity",
  "offer_depth",
  "price_consensus",
  "liquidity",
  "deal",
  "price_confidence",
  "external_comp_confidence",
  "listing_health",
  "demand",
  "collector_premium",
  "collateral_readiness"
] as const satisfies readonly StoredCardScoreType[];

const cardScoreTypeSet = new Set<string>(CARD_SCORE_TYPES);

type DbRows = {
  cards: (typeof cardsTable.$inferSelect)[];
  prices: (typeof latestCardPrices.$inferSelect)[];
  scores: (typeof scoresTable.$inferSelect)[];
  externalComps: (typeof externalPriceSnapshots.$inferSelect)[];
  intents: (typeof intentsTable.$inferSelect)[];
  intentMatches: (typeof intentMatches.$inferSelect)[];
  bundles: (typeof bundles.$inferSelect)[];
  bundleItems: (typeof bundleItems.$inferSelect)[];
  packActivities: (typeof packActivities.$inferSelect)[];
  sourceRecords: (typeof sourceRecords.$inferSelect)[];
  syncRuns: (typeof syncRuns.$inferSelect)[];
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

function isStoredCardScoreType(value: string): value is StoredCardScoreType {
  return cardScoreTypeSet.has(value);
}

function confidenceLabel(value: string): ConfidenceLabel {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function activeIntentInput(intent: {
  id: string;
  intentType: string;
  queryText: string;
  tcg?: string | null;
  characterName?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  grader?: string | null;
  grade?: string | null;
  language?: string | null;
  minYear?: number | null;
  maxYear?: number | null;
  minPriceUsd?: string | number | null;
  maxPriceUsd?: string | number | null;
  requiresSerialAdjacency?: boolean | null;
  requiresExternalComp?: boolean | null;
  minLiquidityScore?: string | number | null;
  status?: string | null;
  createdAt?: Date | string | null;
  expiresAt?: Date | string | null;
  metadata?: unknown;
}): IntentMatchingIntentInput {
  const metadata = toRecord(intent.metadata);

  return {
    id: intent.id,
    intentType: intent.intentType,
    queryText: intent.queryText,
    tcg: intent.tcg ?? null,
    characterName: intent.characterName ?? null,
    setName: intent.setName ?? null,
    cardNumber: intent.cardNumber ?? null,
    grader: intent.grader ?? null,
    grade: intent.grade ?? null,
    language: intent.language ?? null,
    minYear: intent.minYear ?? null,
    maxYear: intent.maxYear ?? null,
    minPriceUsd: intent.minPriceUsd ?? null,
    maxPriceUsd: intent.maxPriceUsd ?? null,
    requiresSerialAdjacency: intent.requiresSerialAdjacency ?? false,
    requiresExternalComp: intent.requiresExternalComp ?? false,
    minLiquidityScore: intent.minLiquidityScore ?? null,
    status: intent.status ?? "active",
    createdAt: intent.createdAt ?? null,
    expiresAt: intent.expiresAt ?? null,
    mockData: metadata["mockData"] === true
  };
}

function matchInputCard(input: {
  card: Parameters<typeof buildMarketCards>[0]["cards"][number];
  price: Parameters<typeof buildMarketCards>[0]["prices"][number] | undefined;
  externalComps: MarketExternalComp[];
  liquidityScore: number | null;
}): IntentMatchingCardInput {
  return {
    tokenId: input.card.tokenId,
    name: input.card.name,
    setName: input.card.setName ?? null,
    cardNumber: input.card.cardNumber ?? null,
    characterName: input.card.characterName ?? null,
    tcg: input.card.tcg ?? null,
    grader: input.card.grader ?? null,
    grade: input.card.grade ?? null,
    language: input.card.language ?? null,
    year: input.card.year ?? null,
    serial: input.card.serial ?? null,
    serialNum: input.card.serialNum ?? null,
    status: input.card.status,
    askPriceUsd: toNumber(input.price?.askPriceUsd),
    fmvUsd: toNumber(input.price?.fmvUsd),
    liquidityScore: input.liquidityScore,
    externalCompConfidenceScore:
      input.externalComps.length === 0
        ? null
        : Math.max(...input.externalComps.map((comp) => comp.matchConfidence)),
    hasAcceptedExternalComp: input.externalComps.some((comp) => !comp.rejected)
  };
}

function mergeIntentMatches(input: {
  persisted: {
    intentId?: string;
    tokenId: string;
    matchScore: string | number;
    confidence?: string;
    reasons?: unknown;
    createdAt?: Date | string | null;
  }[];
  computed: IntentMatchResult[];
  now: Date;
}) {
  const byKey = new Map<
    string,
    {
      intentId?: string;
      tokenId: string;
      matchScore: number;
      confidence?: string;
      reasons?: unknown;
      createdAt?: Date | string | null;
    }
  >();

  for (const match of input.persisted) {
    const score = toNumber(match.matchScore) ?? 0;
    const key = `${match.intentId ?? "persisted"}:${match.tokenId}`;
    byKey.set(key, { ...match, matchScore: score });
  }

  for (const match of input.computed) {
    const key = `${match.intentId}:${match.tokenId}`;
    const current = byKey.get(key);
    if (current == null || match.matchScore > current.matchScore) {
      byKey.set(key, {
        intentId: match.intentId,
        tokenId: match.tokenId,
        matchScore: match.matchScore,
        confidence: match.confidence,
        reasons: match.reasons,
        createdAt: input.now
      });
    }
  }

  return [...byKey.values()];
}

function newerComputedAt(left: string | null | undefined, right: string | null | undefined) {
  if (right == null) return false;
  if (left == null) return true;
  return Date.parse(right) > Date.parse(left);
}

function q3(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const index = Math.floor((sorted.length - 1) * 0.75);
  return sorted[index] ?? null;
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

function unique(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => value != null && value.length > 0))].sort(
    (left, right) => left.localeCompare(right, undefined, { numeric: true })
  );
}

function marketScoreFromDeterministic(score: DeterministicStoredScore): MarketScore {
  return {
    scoreType: score.scoreType,
    value: score.value,
    confidence: score.confidence,
    reasons: score.reasons,
    riskFlags: score.riskFlags,
    computedAt: score.computedAt,
    inputsHash: score.inputsHash,
    source: "deterministic"
  };
}

function marketScoreFromRow(score: {
  scoreType: string;
  scoreValue: string | number;
  confidence: string;
  reasonsJson?: unknown;
  riskFlagsJson?: unknown;
  inputsHash?: string | null;
  computedAt?: Date | string | null;
}): MarketScore | null {
  if (!isStoredCardScoreType(score.scoreType)) return null;
  const value = toNumber(score.scoreValue);
  if (value == null) return null;

  return {
    scoreType: score.scoreType,
    value,
    confidence: confidenceLabel(score.confidence),
    reasons: stringArray(score.reasonsJson),
    riskFlags: stringArray(score.riskFlagsJson),
    computedAt: toIso(score.computedAt) ?? new Date(0).toISOString(),
    inputsHash: score.inputsHash ?? null,
    source: "persisted"
  };
}

function latestScoreMap(
  scores: {
    entityType?: string;
    entityId: string;
    scoreType: string;
    scoreValue: string | number;
    confidence: string;
    reasonsJson?: unknown;
    riskFlagsJson?: unknown;
    inputsHash?: string | null;
    computedAt?: Date | string | null;
  }[]
) {
  const map = new Map<string, MarketScore>();

  for (const score of scores) {
    if (score.entityType != null && score.entityType !== "card") continue;
    const marketScore = marketScoreFromRow(score);
    if (marketScore == null) continue;
    const key = `${score.entityId}:${marketScore.scoreType}`;
    const current = map.get(key);
    if (current == null || newerComputedAt(current.computedAt, marketScore.computedAt)) {
      map.set(key, marketScore);
    }
  }

  return map;
}

function buildMarketCards(input: {
  sourceMode: DataSourceMode;
  cards: {
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
  }[];
  prices: {
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
  }[];
  scores: {
    entityType?: string;
    entityId: string;
    scoreType: string;
    scoreValue: string | number;
    confidence: string;
    reasonsJson?: unknown;
    riskFlagsJson?: unknown;
    inputsHash?: string | null;
    computedAt?: Date | string | null;
  }[];
  externalComps: {
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
  }[];
  intents?: {
    id: string;
    intentType: string;
    queryText: string;
    tcg?: string | null;
    characterName?: string | null;
    setName?: string | null;
    cardNumber?: string | null;
    grader?: string | null;
    grade?: string | null;
    language?: string | null;
    minYear?: number | null;
    maxYear?: number | null;
    minPriceUsd?: string | number | null;
    maxPriceUsd?: string | number | null;
    requiresSerialAdjacency?: boolean | null;
    requiresExternalComp?: boolean | null;
    minLiquidityScore?: string | number | null;
    status?: string | null;
    createdAt?: Date | string | null;
    expiresAt?: Date | string | null;
    metadata?: unknown;
  }[];
  intentMatches?: {
    intentId?: string;
    tokenId: string;
    matchScore: string | number;
    confidence?: string;
    reasons?: unknown;
    createdAt?: Date | string | null;
  }[];
  bundles?: {
    id: string;
    bundleType: string;
  }[];
  bundleItems?: {
    bundleId: string;
    tokenId: string;
  }[];
  packActivities?: {
    matchedTokenId?: string | null;
  }[];
  now: Date;
}) {
  const priceByToken = new Map(input.prices.map((price) => [price.tokenId, price]));
  const scoreByTokenAndType = latestScoreMap(input.scores);
  const compsByToken = new Map<string, MarketExternalComp[]>();
  const intentMatchesByToken = new Map<string, ReturnType<typeof mergeIntentMatches>>();
  const bundleById = new Map((input.bundles ?? []).map((bundle) => [bundle.id, bundle]));
  const bundleTypesByToken = new Map<string, Set<string>>();
  const packOriginTokens = new Set(
    (input.packActivities ?? [])
      .map((activity) => activity.matchedTokenId)
      .filter((tokenId): tokenId is string => tokenId != null && tokenId.length > 0)
  );

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

  const computedIntentMatches = matchIntentsToCards({
    intents: (input.intents ?? []).map(activeIntentInput),
    cards: input.cards.map((card) =>
      matchInputCard({
        card,
        price: priceByToken.get(card.tokenId),
        externalComps: compsByToken.get(card.tokenId) ?? [],
        liquidityScore: scoreByTokenAndType.get(`${card.tokenId}:liquidity`)?.value ?? null
      })
    ),
    now: input.now
  });
  const mergedIntentMatches = mergeIntentMatches({
    persisted: input.intentMatches ?? [],
    computed: computedIntentMatches,
    now: input.now
  });

  for (const match of mergedIntentMatches) {
    const current = intentMatchesByToken.get(match.tokenId) ?? [];
    current.push(match);
    intentMatchesByToken.set(match.tokenId, current);
  }

  for (const item of input.bundleItems ?? []) {
    const bundle = bundleById.get(item.bundleId);
    if (bundle == null) continue;
    const current = bundleTypesByToken.get(item.tokenId) ?? new Set<string>();
    current.add(bundle.bundleType);
    bundleTypesByToken.set(item.tokenId, current);
  }

  const highFmvThreshold = q3(input.prices.map((price) => toNumber(price.fmvUsd) ?? 0));

  return input.cards.map((card): MarketCard => {
    const price = priceByToken.get(card.tokenId);
    const askPriceUsd = toNumber(price?.askPriceUsd);
    const fmvUsd = toNumber(price?.fmvUsd);
    const offerPriceUsd = toNumber(price?.offerPriceUsd);
    const topOfferUsd = toNumber(price?.topOfferUsd);
    const lastSaleUsd = toNumber(price?.lastSaleUsd);
    const buybackBaseValueUsd = toNumber(price?.buybackBaseValueUsd);
    const metadata = toRecord(card.metadata);
    const mockData = metadata["mockData"] === true || input.sourceMode === "seed";
    const observedAt = toIso(price?.observedAt ?? card.lastSeenAt);
    const externalComps = compsByToken.get(card.tokenId) ?? [];
    const bundleTypes = bundleTypesByToken.get(card.tokenId) ?? new Set<string>();
    const scorerInput: DeterministicCardScoringInput = {
      tokenId: card.tokenId,
      status: card.status,
      askPriceUsd,
      fmvUsd,
      offerPriceUsd,
      topOfferUsd,
      lastSaleUsd,
      buybackBaseValueUsd,
      observedAt,
      lastSaleAt: lastSaleUsd == null ? null : observedAt,
      askChangedAt: observedAt,
      externalComps: externalComps.map((comp) => ({
        priceUsd: comp.currentPriceUsd,
        averagePriceUsd: comp.averagePriceUsd,
        matchConfidence: comp.matchConfidence,
        rejected: comp.rejected,
        fetchedAt: comp.fetchedAt
      })),
      intentMatches: (intentMatchesByToken.get(card.tokenId) ?? []).map((match) => ({
        matchScore: match.matchScore,
        createdAt: match.createdAt ?? null
      })),
      adjacentCertExists: bundleTypes.has("sequential_cert_pair"),
      sameCharacterBundleExists: bundleTypes.has("same_character"),
      sameSetBundleExists: bundleTypes.has("same_set"),
      packOriginStory: packOriginTokens.has(card.tokenId),
      highFmvPercentile: highFmvThreshold == null ? false : fmvUsd != null && fmvUsd >= highFmvThreshold,
      grade: card.grade ?? null,
      mockData,
      now: input.now
    };
    const deterministicScores = Object.fromEntries(
      Object.values(scoreCard(scorerInput).scores).map((score) => [
        score.scoreType,
        marketScoreFromDeterministic(score)
      ])
    ) as Partial<Record<StoredCardScoreType, MarketScore>>;
    const persistedScores: Partial<Record<StoredCardScoreType, MarketScore>> = {};
    for (const scoreType of CARD_SCORE_TYPES) {
      const score = scoreByTokenAndType.get(`${card.tokenId}:${scoreType}`);
      if (score != null) persistedScores[scoreType] = score;
    }
    const scoreDetails: Partial<Record<StoredCardScoreType, MarketScore>> = {
      ...deterministicScores,
      ...persistedScores
    };
    const liquidityScore = scoreDetails.liquidity?.value ?? null;
    const dealScore = scoreDetails.deal?.value ?? null;
    const priceConfidenceScore = scoreDetails.price_confidence?.value ?? null;
    const externalCompConfidenceScore = scoreDetails.external_comp_confidence?.value ?? null;
    const riskFlags = unique([
      ...(mockData ? ["mock_data"] : []),
      ...(price?.isListed === true && askPriceUsd == null ? ["listed_without_ask"] : []),
      ...(externalComps.some((comp) => comp.rejected) ? ["external_comp_mismatch"] : []),
      ...Object.values(scoreDetails).flatMap((score) => score.riskFlags)
    ]);

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
      offerPriceUsd,
      topOfferUsd,
      lastSaleUsd,
      buybackBaseValueUsd,
      liquidityScore,
      dealScore,
      priceConfidenceScore,
      externalCompConfidenceScore,
      scores: scoreDetails,
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
      externalComps
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
  sourceRows: { source: string; fetchedAt: Date | string }[];
  syncRuns: {
    id: string;
    jobName: string;
    source: string | null;
    status: string;
    startedAt: Date | string;
    finishedAt: Date | string | null;
    recordsSeen: number;
    recordsFailed: number;
  }[];
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
    source: freshness.source,
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
    scores: demoScores,
    externalComps: demoExternalPrices,
    intentMatches: demoIntentMatches,
    intents: demoIntents,
    bundles: demoBundles,
    bundleItems: demoBundleItems,
    packActivities: demoPackActivities,
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
    const [
      cards,
      prices,
      scoreRows,
      externalComps,
      intentMatchRows,
      intentRows,
      bundleRows,
      bundleItemRows,
      packActivityRows,
      sourceRows,
      runRows
    ] = await Promise.all([
      database.db.select().from(cardsTable),
      database.db.select().from(latestCardPrices),
      database.db.select().from(scoresTable),
      database.db.select().from(externalPriceSnapshots),
      database.db.select().from(intentMatches),
      database.db.select().from(intentsTable),
      database.db.select().from(bundles),
      database.db.select().from(bundleItems),
      database.db.select().from(packActivities),
      database.db.select().from(sourceRecords),
      database.db.select().from(syncRuns)
    ]);

    return {
      cards,
      prices,
      scores: scoreRows,
      externalComps,
      intents: intentRows,
      intentMatches: intentMatchRows,
      bundles: bundleRows,
      bundleItems: bundleItemRows,
      packActivities: packActivityRows,
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
    intentMatches: dbRows.intentMatches,
    intents: dbRows.intents,
    bundles: dbRows.bundles,
    bundleItems: dbRows.bundleItems,
    packActivities: dbRows.packActivities,
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
