import { generateCardMemo, type AiCardMemoResult, type AiMemoInput } from "@renaiss/ai";
import {
  scoreRenaissOsCard,
  type ActionRecommendation,
  type Freshness,
  type RiskFlag,
  type Score,
  type ScoreConfidence,
  type ScoreType,
  type SourceRef
} from "@renaiss/core";

import { createRenaissOSClient } from "./client";
import { formatGradeLabel } from "./display";
import type {
  RenaissOsCardDetail,
  RenaissOsCardSummary,
  RenaissOsFmvSeriesResponse,
  RenaissOsGradedLookup,
  RenaissOsIndexDetail,
  RenaissOsTradeRow
} from "./schemas";

export type RenaissOsCardPath = {
  game: string;
  set: string;
  card: string;
  href: string;
};

type RenaissOsMarketPulse = {
  generatedAt: string;
  indices: RenaissOsIndexDetail[];
  featured: RenaissOsCardSummary[];
  recentTrades: Awaited<
    ReturnType<ReturnType<typeof createRenaissOSClient>["getRecentTrades"]>
  >["data"]["trades"];
};

type RenaissOsCardScoreView = {
  scoreType: ScoreType;
  label: RenaissOsScoreLabel;
  value: number;
  confidence: ScoreConfidence;
  reasons: string[];
  riskFlags: RiskFlag[];
};

export type RenaissOsCardIntelligence = {
  generatedAt: string;
  path: RenaissOsCardPath;
  card: RenaissOsCardDetail;
  trades: RenaissOsTradeRow[];
  fmvSeries: RenaissOsFmvSeriesResponse;
  scores: RenaissOsCardScoreView[];
};

type RenaissOsCardEvidence = Pick<RenaissOsCardIntelligence, "card" | "trades" | "fmvSeries">;

const SCORE_LABELS = {
  activity_velocity: "Market activity",
  liquidity: "Liquidity",
  price_confidence: "FMV reliability",
  source_confidence: "Data depth"
} as const satisfies Record<ScoreType, string>;

type RenaissOsScoreLabel = (typeof SCORE_LABELS)[ScoreType];

export function formatUsdCents(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value / 100);
}

export function encodeRenaissOsCardToken(href: string): string {
  const path = parseRenaissOsCardHref(href);
  if (path == null) {
    throw new Error("Invalid Renaiss OS card href.");
  }
  return Buffer.from(path.href, "utf8").toString("base64url");
}

export function decodeRenaissOsCardToken(token: string): RenaissOsCardPath | null {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;

  const decoded = Buffer.from(token, "base64url").toString("utf8");
  const canonicalToken = Buffer.from(decoded, "utf8").toString("base64url");
  return canonicalToken === token ? parseRenaissOsCardHref(decoded) : null;
}

export function parseRenaissOsCardHref(href: string): RenaissOsCardPath | null {
  const match = /^\/card\/([^/?#]+)\/([^/?#]+)\/([^/?#]+)$/.exec(href);
  if (match == null) return null;
  const [, game, set, card] = match;
  if (game == null || set == null || card == null) return null;
  return {
    game,
    set,
    card,
    href
  };
}

export function atlasCardHref(card: Pick<RenaissOsCardSummary, "href">): string {
  return `/cards/${encodeRenaissOsCardToken(card.href)}`;
}

export function atlasIndexHref(game: string): string {
  return `/market/${encodeURIComponent(game)}`;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function sourceConfidence(value: RenaissOsCardDetail["confidence"]): ScoreConfidence {
  if (value === "prime" || value === "high") return "high";
  if (value === "medium") return "medium";
  return "low";
}

function validUrl(value: string | null | undefined): string | undefined {
  return value != null && URL.canParse(value) ? new URL(value).toString() : undefined;
}

type SourceRefInput = {
  id: string;
  source: SourceRef["source"];
  fetchedAt: string;
  confidence: SourceRef["confidence"];
  sourceUrl?: string | undefined;
};

function sourceRef(input: SourceRefInput): SourceRef {
  return {
    id: input.id,
    source: input.source,
    fetchedAt: input.fetchedAt,
    confidence: input.confidence,
    ...(input.sourceUrl == null ? {} : { sourceUrl: input.sourceUrl })
  };
}

function scoreLabel(scoreType: ScoreType): RenaissOsScoreLabel {
  return SCORE_LABELS[scoreType];
}

function scoreCardEvidence(input: RenaissOsCardEvidence) {
  return scoreRenaissOsCard({
    cardId: input.card.id,
    confidence: input.card.confidence,
    sourceCount: input.card.sourceCount,
    observationCount: input.card.observationCount,
    totalObservationCount: input.card.totalObservationCount,
    lastSaleAt: input.card.lastSaleAt,
    updatedAt: input.card.updatedAt,
    priceUsdCents: input.card.priceUsdCents,
    trades: input.trades.map((trade) => ({
      observedAt: trade.observedAt,
      kind: trade.kind,
      priceUsdCents: trade.priceUsdCents,
      source: trade.source
    })),
    fmvSeries: input.fmvSeries.points.map((point) => ({
      t: point.t,
      usdCents: point.usdCents,
      n: point.n
    })),
    sourceBreakdown: input.card.sourceBreakdown.map((entry) => ({
      source: entry.source,
      count: entry.count,
      medianUsdCents: entry.medianUsdCents,
      ...(entry.category == null ? {} : { category: entry.category })
    }))
  });
}

function scoresForCard(input: RenaissOsCardEvidence) {
  const scored = scoreCardEvidence(input);

  return Object.values(scored.scores)
    .filter((score) => score.scoreType !== "source_confidence")
    .map(
      (score): RenaissOsCardScoreView => ({
        scoreType: score.scoreType,
        label: scoreLabel(score.scoreType),
        value: score.value,
        confidence: score.confidence,
        reasons: score.reasons,
        riskFlags: score.riskFlags
      })
    );
}

function scoreForMemo(
  score: ReturnType<typeof scoreRenaissOsCard>["scores"][keyof ReturnType<
    typeof scoreRenaissOsCard
  >["scores"]]
): Score {
  return {
    entityType: score.entityType,
    entityId: score.entityId,
    scoreType: score.scoreType,
    scoreValue: score.value,
    confidence: score.confidence,
    inputsHash: score.inputsHash,
    reasons: score.reasons,
    riskFlags: score.riskFlags,
    computedAt: score.computedAt
  };
}

function medianUsdCents(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  const upper = sorted[midpoint];
  if (upper == null) return null;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[midpoint - 1];
  return lower == null ? upper : Math.round((lower + upper) / 2);
}

function freshnessFor(card: RenaissOsCardDetail): Freshness[] {
  const observedAt = card.lastSaleAt ?? card.updatedAt ?? undefined;
  const status =
    observedAt == null
      ? "missing"
      : Date.now() - Date.parse(observedAt) > 1000 * 60 * 60 * 24 * 45
        ? "stale"
        : "fresh";

  return [
    {
      source: "renaiss_os_index",
      observedAt,
      status,
      message: "Renaiss Index data."
    }
  ];
}

function sourceRefsFor(
  card: RenaissOsCardDetail,
  trades: RenaissOsTradeRow[],
  fmv: RenaissOsFmvSeriesResponse
): SourceRef[] {
  const fetchedAt = card.updatedAt ?? card.lastSaleAt ?? new Date().toISOString();
  const refs = [
    sourceRef({
      id: `renaiss-os:card:${card.id}`,
      source: "renaiss_os_index",
      sourceUrl: validUrl(card.pageUrl),
      fetchedAt,
      confidence: sourceConfidence(card.confidence)
    }),
    sourceRef({
      id: `renaiss-os:trades:${card.id}`,
      source: "renaiss_os_index",
      sourceUrl: validUrl(`${card.pageUrl}#trades`),
      fetchedAt: trades[0]?.observedAt ?? fetchedAt,
      confidence: trades.length > 0 ? "high" : "low"
    }),
    sourceRef({
      id: `renaiss-os:fmv:${card.id}`,
      source: "renaiss_os_index",
      sourceUrl: validUrl(`${card.pageUrl}#fmv`),
      fetchedAt: fmv.points[0]?.t ?? fetchedAt,
      confidence: fmv.points.length > 0 ? sourceConfidence(card.confidence) : "low"
    }),
    ...card.sourceBreakdown.slice(0, 6).map(
      (entry): SourceRef =>
        sourceRef({
          id: `renaiss-os:source:${card.id}:${entry.source}`,
          source: "renaiss_os_index",
          sourceUrl: validUrl(entry.overviewUrl) ?? validUrl(card.pageUrl),
          fetchedAt,
          confidence: entry.count >= 3 ? "high" : entry.count > 0 ? "medium" : "low"
        })
    )
  ];

  return refs.filter((ref, index, all) => all.findIndex((item) => item.id === ref.id) === index);
}

function buildMemoInput(input: RenaissOsCardEvidence): AiMemoInput {
  const scored = scoreCardEvidence(input);
  const scores = Object.values(scored.scores)
    .filter((score) => score.scoreType !== "source_confidence")
    .map(scoreForMemo);
  const sources = sourceRefsFor(input.card, input.trades, input.fmvSeries);
  const sourceIds = sources.map((source) => source.id);
  const riskFlags = [...new Set(scores.flatMap((score) => score.riskFlags))];
  const confidence = sourceConfidence(input.card.confidence);
  const transactionCount = input.trades.filter((trade) => trade.kind === "transaction").length;
  const listingCount = input.trades.filter((trade) => trade.kind === "listing").length;
  const pricedTrades = input.trades
    .filter((trade) => trade.priceUsdCents != null)
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  const recentTradePrices = pricedTrades
    .map((trade) => trade.priceUsdCents)
    .filter((value): value is number => value != null);
  const latestTrade = pricedTrades[0] ?? null;
  const latestFmv = input.fmvSeries.points.at(-1) ?? null;
  const previousFmv = input.fmvSeries.points.at(-2) ?? null;
  const actions: ActionRecommendation[] = [
    {
      subjectType: "card",
      subjectId: input.card.id,
      actionType: "REVIEW_SOURCES",
      priority: 1,
      title: "Compare card signals",
      reason:
        "Compare confidence, recent trades, and FMV history before making any collector decision.",
      confidence,
      risks: riskFlags,
      sourceIds,
      cta: {
        label: "Compare card signals",
        href: input.card.href
      }
    }
  ];

  return {
    subject: { type: "card", id: input.card.id },
    card: {
      tokenId: input.card.id,
      itemId: input.card.href,
      name: input.card.name,
      normalizedName: normalizeName(input.card.name),
      setName: input.card.setName,
      cardNumber: input.card.cardNumber,
      characterName: input.card.name,
      tcg: input.card.game,
      grader: input.card.company,
      grade: formatGradeLabel({
        company: input.card.company,
        grade: input.card.grade,
        gradeLabel: input.card.gradeLabel
      }),
      language: input.card.language,
      imageUrl: input.card.imageUrlLg ?? input.card.imageUrl,
      status: "unknown",
      firstSeenAt: input.card.updatedAt ?? input.card.lastSaleAt ?? new Date().toISOString(),
      lastSeenAt: input.card.updatedAt ?? input.card.lastSaleAt ?? new Date().toISOString()
    },
    officialEvidence: {
      confidence: input.card.confidence,
      lastSaleAt: input.card.lastSaleAt ?? null,
      updatedAt: input.card.updatedAt ?? null,
      priceUsdCents: input.card.priceUsdCents ?? null,
      tradeCount: input.trades.length,
      transactionCount,
      listingCount,
      fmvPointCount: input.fmvSeries.points.length,
      priceAction: {
        latestTradeKind: latestTrade?.kind ?? null,
        latestTradeObservedAt: latestTrade?.observedAt ?? null,
        latestTradeUsdCents: latestTrade?.priceUsdCents ?? null,
        lowestRecentTradeUsdCents:
          recentTradePrices.length === 0 ? null : Math.min(...recentTradePrices),
        medianRecentTradeUsdCents: medianUsdCents(recentTradePrices),
        highestRecentTradeUsdCents:
          recentTradePrices.length === 0 ? null : Math.max(...recentTradePrices),
        latestFmvUsdCents: latestFmv?.usdCents ?? null,
        previousFmvUsdCents: previousFmv?.usdCents ?? null
      }
    },
    scores,
    candidateActions: actions,
    sources,
    riskFlags,
    freshness: freshnessFor(input.card),
    officialApi: true
  };
}

async function fetchCardEvidence(path: RenaissOsCardPath): Promise<RenaissOsCardEvidence> {
  const client = createRenaissOSClient();
  const [card, trades, fmvSeries] = await Promise.all([
    client.getCard(path.game, path.set, path.card),
    client.getCardTrades(
      path.game,
      path.set,
      path.card,
      new URLSearchParams({ limit: "50", window: "365" })
    ),
    client.getCardFmvSeries(path.game, path.set, path.card, new URLSearchParams({ window: "365" }))
  ]);

  return {
    card: card.data,
    trades: trades.data.trades,
    fmvSeries: fmvSeries.data
  };
}

export async function getRenaissOsMarketPulse(): Promise<RenaissOsMarketPulse> {
  const client = createRenaissOSClient();
  const [indices, featured, recentTrades] = await Promise.all([
    client.getIndices(),
    client.getFeatured(12),
    client.getRecentTrades(12)
  ]);
  const indexDetails = await Promise.all(
    indices.data.indices.map((index) => client.getIndex(index.game))
  );

  return {
    generatedAt: new Date().toISOString(),
    indices: indexDetails.map((index) => index.data),
    featured: featured.data.cards,
    recentTrades: recentTrades.data.trades
  };
}

export async function getRenaissOsIndexDetail(game: string): Promise<RenaissOsIndexDetail | null> {
  const allowedGames = new Set(["pokemon", "one-piece", "sports"]);
  if (!allowedGames.has(game)) return null;
  return (await createRenaissOSClient().getIndex(game)).data;
}

export async function searchRenaissOsCards(query: string) {
  if (query.trim().length === 0) {
    return {
      query: "",
      results: []
    };
  }
  const response = await createRenaissOSClient().searchCards(query, 24);
  return response.data;
}

export async function getRenaissOsCardIntelligence(
  path: RenaissOsCardPath
): Promise<RenaissOsCardIntelligence> {
  const evidence = await fetchCardEvidence(path);

  return {
    generatedAt: new Date().toISOString(),
    path,
    ...evidence,
    scores: scoresForCard(evidence)
  };
}

export async function generateRenaissOsCollectorBrief(
  path: RenaissOsCardPath
): Promise<AiCardMemoResult> {
  return generateCardMemo(buildMemoInput(await fetchCardEvidence(path)));
}

export async function lookupRenaissOsGradedCert(cert: string): Promise<RenaissOsGradedLookup> {
  return (await createRenaissOSClient().getGraded(cert)).data;
}

export function renaissConfidenceSummary(card: RenaissOsCardDetail): string {
  const confidence = card.confidence ?? "unknown";
  if (confidence === "prime") {
    return "Renaiss confidence is prime: this is the strongest Renaiss confidence tier for the current FMV.";
  }
  if (confidence === "high") {
    return "Renaiss confidence is high: the FMV is strongly supported by current Renaiss records.";
  }
  if (confidence === "medium") {
    return "Renaiss confidence is medium: the FMV is usable, but recent trades and FMV history should carry more weight.";
  }
  if (confidence === "low") {
    return "Renaiss confidence is low: treat the FMV cautiously because the available records are thin or stale.";
  }
  return "Renaiss did not return a confidence tier for this card.";
}
