import {
  generateCardMemo,
  type AiCardMemoResult,
  type AiMemoInput
} from "@renaiss/ai";
import {
  scoreRenaissOsCard,
  type ActionRecommendation,
  type Freshness,
  type Score,
  type ScoreConfidence,
  type SourceRef
} from "@renaiss/core";

import { createRenaissOSClient } from "./client";
import type {
  RenaissOsCardDetail,
  RenaissOsCardSummary,
  RenaissOsFmvSeriesResponse,
  RenaissOsGradedLookup,
  RenaissOsTradeRow
} from "./schemas";

export type RenaissOsCardPath = {
  game: string;
  set: string;
  card: string;
  href: string;
};

export type RenaissOsMarketPulse = {
  generatedAt: string;
  indices: Awaited<ReturnType<ReturnType<typeof createRenaissOSClient>["getIndices"]>>["data"]["indices"];
  featured: RenaissOsCardSummary[];
  recentTrades: Awaited<ReturnType<ReturnType<typeof createRenaissOSClient>["getRecentTrades"]>>["data"]["trades"];
};

export type RenaissOsCardScoreView = {
  scoreType: string;
  label: string;
  value: number;
  confidence: ScoreConfidence;
  reasons: string[];
  riskFlags: string[];
};

export type RenaissOsCardIntelligence = {
  generatedAt: string;
  path: RenaissOsCardPath;
  card: RenaissOsCardDetail;
  trades: RenaissOsTradeRow[];
  fmvSeries: RenaissOsFmvSeriesResponse;
  scores: RenaissOsCardScoreView[];
  memo: AiCardMemoResult | null;
  memoError: string | null;
};

function centsToUsd(value: number | null | undefined): number | null {
  return value == null ? null : value / 100;
}

export function formatUsdCents(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value / 100);
}

export function encodeRenaissOsCardToken(href: string): string {
  return Buffer.from(href, "utf8").toString("base64url");
}

export function decodeRenaissOsCardToken(token: string): string {
  if (token.startsWith("/card/")) return token;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    return decoded.startsWith("/card/") ? decoded : token;
  } catch {
    return token;
  }
}

export function parseRenaissOsCardHref(value: string): RenaissOsCardPath | null {
  const href = decodeRenaissOsCardToken(value);
  const withoutQuery = href.split("?")[0] ?? href;
  const parts = withoutQuery.split("/").filter(Boolean);
  if (parts.length !== 4 || parts[0] !== "card") return null;
  const game = parts[1];
  const set = parts[2];
  const card = parts[3];
  if (game == null || set == null || card == null) return null;
  return {
    game,
    set,
    card,
    href: `/${parts.join("/")}`
  };
}

export function atlasCardHref(card: Pick<RenaissOsCardSummary, "href">): string {
  return `/cards/${encodeURIComponent(encodeRenaissOsCardToken(card.href))}`;
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
  if (value == null) return undefined;
  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
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

function scoreLabel(scoreType: string): string {
  if (scoreType === "activity_velocity") return "Recent market activity";
  if (scoreType === "deal") return "Evidence memo readiness";
  if (scoreType === "price_confidence") return "FMV confidence";
  if (scoreType === "source_confidence") return "Evidence depth";
  if (scoreType === "liquidity") return "Liquidity signal";
  return scoreType.replaceAll("_", " ");
}

function scoresForCard(input: {
  card: RenaissOsCardDetail;
  trades: RenaissOsTradeRow[];
  fmvSeries: RenaissOsFmvSeriesResponse;
}) {
  const scored = scoreRenaissOsCard({
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

  return Object.values(scored.scores)
    .filter((score) => score.scoreType !== "source_confidence")
    .map((score): RenaissOsCardScoreView => ({
      scoreType: score.scoreType,
      label: scoreLabel(score.scoreType),
      value: score.value,
      confidence: score.confidence,
      reasons: score.reasons,
      riskFlags: score.riskFlags
    }));
}

function scoreForMemo(score: ReturnType<typeof scoreRenaissOsCard>["scores"][keyof ReturnType<typeof scoreRenaissOsCard>["scores"]]): Score | null {
  if (score == null) return null;
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

function sourceRefsFor(card: RenaissOsCardDetail, trades: RenaissOsTradeRow[], fmv: RenaissOsFmvSeriesResponse): SourceRef[] {
  const fetchedAt = card.updatedAt ?? card.lastSaleAt ?? new Date().toISOString();
  const refs = [
    sourceRef({
      id: `renaiss-os:card:${card.id}`,
      source: "renaiss_os_index" as const,
      sourceUrl: validUrl(card.pageUrl),
      fetchedAt,
      confidence: sourceConfidence(card.confidence)
    }),
    sourceRef({
      id: `renaiss-os:trades:${card.id}`,
      source: "renaiss_os_index" as const,
      sourceUrl: validUrl(`${card.pageUrl}#trades`),
      fetchedAt: trades[0]?.observedAt ?? fetchedAt,
      confidence: trades.length > 0 ? "high" as const : "low" as const
    }),
    sourceRef({
      id: `renaiss-os:fmv:${card.id}`,
      source: "renaiss_os_index" as const,
      sourceUrl: validUrl(`${card.pageUrl}#fmv`),
      fetchedAt: fmv.points[0]?.t ?? fetchedAt,
      confidence: fmv.points.length > 0 ? sourceConfidence(card.confidence) : "low"
    }),
    ...card.sourceBreakdown.slice(0, 6).map((entry): SourceRef =>
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

function buildMemoInput(input: {
  card: RenaissOsCardDetail;
  trades: RenaissOsTradeRow[];
  fmvSeries: RenaissOsFmvSeriesResponse;
}): AiMemoInput {
  const scored = scoreRenaissOsCard({
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
  const scores = Object.values(scored.scores)
    .filter((score) => score.scoreType !== "source_confidence")
    .map(scoreForMemo)
    .filter((score): score is Score => score != null);
  const sources = sourceRefsFor(input.card, input.trades, input.fmvSeries);
  const sourceIds = sources.map((source) => source.id);
  const riskFlags = [...new Set(scores.flatMap((score) => score.riskFlags))];
  const confidence = sourceConfidence(input.card.confidence);
  const transactionCount = input.trades.filter((trade) => trade.kind === "transaction").length;
  const listingCount = input.trades.filter((trade) => trade.kind === "listing").length;
  const actions: ActionRecommendation[] = [
    {
      subjectType: "card",
      subjectId: input.card.id,
      actionType: "REVIEW_SOURCES",
      priority: 1,
      title: "Review Renaiss data",
      reason: "Review Renaiss confidence, trades, and FMV history before making any collector decision.",
      confidence,
      risks: riskFlags,
      sourceIds,
      cta: {
        label: "Review Renaiss data",
        href: "/sources"
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
      grade: input.card.gradeLabel,
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
      fmvPointCount: input.fmvSeries.points.length
    },
    scores,
    candidateActions: actions,
    sources,
    riskFlags,
    freshness: freshnessFor(input.card),
    officialApi: true
  };
}

export async function getRenaissOsMarketPulse(): Promise<RenaissOsMarketPulse> {
  const client = createRenaissOSClient();
  const [indices, featured, recentTrades] = await Promise.all([
    client.getIndices(),
    client.getFeatured(12),
    client.getRecentTrades(12)
  ]);

  return {
    generatedAt: new Date().toISOString(),
    indices: indices.data.indices,
    featured: featured.data.cards,
    recentTrades: recentTrades.data.trades
  };
}

export async function searchRenaissOsCards(query: string) {
  if (query.trim().length === 0) {
    return {
      query: "",
      results: [] as RenaissOsCardSummary[]
    };
  }
  const response = await createRenaissOSClient().searchCards(query, 24);
  return response.data;
}

export async function getRenaissOsCardIntelligence(token: string): Promise<RenaissOsCardIntelligence | null> {
  const path = parseRenaissOsCardHref(token);
  if (path == null) return null;

  const client = createRenaissOSClient();
  const [card, trades, fmvSeries] = await Promise.all([
    client.getCard(path.game, path.set, path.card),
    client.getCardTrades(path.game, path.set, path.card, new URLSearchParams({ limit: "50", window: "365" })),
    client.getCardFmvSeries(path.game, path.set, path.card, new URLSearchParams({ window: "365" }))
  ]);
  const scores = scoresForCard({
    card: card.data,
    trades: trades.data.trades,
    fmvSeries: fmvSeries.data
  });
  let memo: AiCardMemoResult | null = null;
  let memoError: string | null = null;
  try {
    memo = await generateCardMemo(
      buildMemoInput({
        card: card.data,
        trades: trades.data.trades,
        fmvSeries: fmvSeries.data
      })
    );
  } catch (error) {
    memoError = error instanceof Error ? error.message : "OpenRouter memo generation failed.";
  }

  return {
    generatedAt: new Date().toISOString(),
    path,
    card: card.data,
    trades: trades.data.trades,
    fmvSeries: fmvSeries.data,
    scores,
    memo,
    memoError
  };
}

export async function lookupRenaissOsGradedCert(cert: string): Promise<RenaissOsGradedLookup> {
  return (await createRenaissOSClient().getGraded(cert)).data;
}

export function renaissConfidenceSummary(card: RenaissOsCardDetail): string {
  const confidence = card.confidence ?? "unknown";
  return `Renaiss confidence: ${confidence}.`;
}

export { centsToUsd };
