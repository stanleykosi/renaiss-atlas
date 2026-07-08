import { hashPayload } from "../utils/hash.js";
import type {
  DeterministicStoredScore,
  ScoreConfidence,
  StoredCardScoreType
} from "./deterministic.js";

export type RenaissOsConfidence = "prime" | "high" | "medium" | "low" | null;

export type RenaissOsTradeSignal = {
  observedAt: Date | string;
  kind: "listing" | "transaction";
  priceUsdCents?: number | null;
  source?: string | null;
};

export type RenaissOsFmvPointSignal = {
  t: Date | string;
  usdCents: number;
  n: number;
};

export type RenaissOsSourceBreakdownSignal = {
  source: string;
  category?: string | null;
  count: number;
  medianUsdCents?: number | null;
};

export type RenaissOsCardScoringInput = {
  cardId: string;
  confidence: RenaissOsConfidence;
  sourceCount?: number | null;
  observationCount?: number | null;
  totalObservationCount?: number | null;
  lastSaleAt?: Date | string | null;
  updatedAt?: Date | string | null;
  priceUsdCents?: number | null;
  trades?: RenaissOsTradeSignal[];
  fmvSeries?: RenaissOsFmvPointSignal[];
  sourceBreakdown?: RenaissOsSourceBreakdownSignal[];
  now?: Date;
};

export type RenaissOsCardScoreSet = {
  scores: Partial<Record<StoredCardScoreType, DeterministicStoredScore>>;
};

const confidenceValue: Record<Exclude<RenaissOsConfidence, null>, number> = {
  prime: 96,
  high: 84,
  medium: 58,
  low: 32
};

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function roundScore(value: number): number {
  return Number(clamp(value).toFixed(2));
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageDays(value: Date | string | null | undefined, now: Date): number | null {
  const date = toDate(value);
  if (date == null) return null;
  return Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
}

function officialConfidenceScore(value: RenaissOsConfidence): number {
  return value == null ? 18 : confidenceValue[value];
}

function scoreConfidence(value: number, riskFlags: readonly string[]): ScoreConfidence {
  if (riskFlags.includes("official_confidence_low") || riskFlags.includes("official_observations_missing")) {
    return value >= 50 ? "medium" : "low";
  }
  if (value >= 75) return "high";
  if (value >= 45) return "medium";
  return "low";
}

function recencyScore(value: Date | string | null | undefined, now: Date): number {
  const age = ageDays(value, now);
  if (age == null) return 12;
  if (age <= 7) return 100;
  if (age <= 30) return 78;
  if (age <= 90) return 52;
  if (age <= 365) return 30;
  return 15;
}

function sourceCoverage(sourceCount: number | null | undefined): number {
  return clamp(((sourceCount ?? 0) / 4) * 100);
}

function observationCoverage(observationCount: number | null | undefined): number {
  return clamp(((observationCount ?? 0) / 12) * 100);
}

function tradeActivityScore(trades: readonly RenaissOsTradeSignal[], now: Date): number {
  const transactions = trades.filter((trade) => trade.kind === "transaction");
  const listings = trades.filter((trade) => trade.kind === "listing");
  const recentTransactions = transactions.filter((trade) => (ageDays(trade.observedAt, now) ?? 999) <= 30);
  const recentListings = listings.filter((trade) => (ageDays(trade.observedAt, now) ?? 999) <= 30);

  return clamp(recentTransactions.length * 18 + recentListings.length * 8 + transactions.length * 4);
}

function fmvDepthScore(points: readonly RenaissOsFmvPointSignal[]): number {
  const observations = points.reduce((sum, point) => sum + point.n, 0);
  return clamp(points.length * 5 + observations * 3);
}

function sourceBreakdownScore(sourceBreakdown: readonly RenaissOsSourceBreakdownSignal[]): number {
  const sourceCount = new Set(sourceBreakdown.map((entry) => entry.source)).size;
  const categoryCount = new Set(sourceBreakdown.map((entry) => entry.category).filter(Boolean)).size;
  const observations = sourceBreakdown.reduce((sum, entry) => sum + entry.count, 0);
  return clamp(sourceCount * 18 + categoryCount * 8 + observations * 2);
}

function result(input: {
  value: number;
  reasons: string[];
  riskFlags: string[];
  inputs: Record<string, unknown>;
}) {
  return {
    value: roundScore(input.value),
    confidence: scoreConfidence(input.value, input.riskFlags),
    reasons: input.reasons,
    riskFlags: input.riskFlags,
    inputs: input.inputs
  };
}

function stored(input: {
  cardId: string;
  scoreType: StoredCardScoreType;
  computedAt: string;
  score: ReturnType<typeof result>;
}): DeterministicStoredScore {
  return {
    entityType: "card",
    entityId: input.cardId,
    scoreType: input.scoreType,
    ...input.score,
    inputsHash: hashPayload({
      scoreType: input.scoreType,
      cardId: input.cardId,
      inputs: input.score.inputs
    }),
    computedAt: input.computedAt
  };
}

export function scoreRenaissOsCard(input: RenaissOsCardScoringInput): RenaissOsCardScoreSet {
  const now = input.now ?? new Date();
  const computedAt = now.toISOString();
  const official = officialConfidenceScore(input.confidence);
  const sources = sourceCoverage(input.sourceCount);
  const observations = observationCoverage(input.observationCount);
  const totalObservations = observationCoverage(input.totalObservationCount);
  const recency = recencyScore(input.lastSaleAt ?? input.updatedAt, now);
  const activity = tradeActivityScore(input.trades ?? [], now);
  const fmvDepth = fmvDepthScore(input.fmvSeries ?? []);
  const breakdown = sourceBreakdownScore(input.sourceBreakdown ?? []);
  const riskFlags: string[] = [];

  if (input.confidence === "low" || input.confidence == null) riskFlags.push("official_confidence_low");
  if ((input.observationCount ?? 0) === 0) riskFlags.push("official_observations_missing");
  if ((input.sourceCount ?? 0) <= 1) riskFlags.push("single_source_evidence");
  if (ageDays(input.lastSaleAt, now) != null && (ageDays(input.lastSaleAt, now) ?? 0) > 90) {
    riskFlags.push("stale_last_sale");
  }

  const priceConfidence = result({
    value: official * 0.45 + sources * 0.22 + observations * 0.2 + recency * 0.13,
    reasons: [
      "Price confidence uses official Renaiss OS confidence, source count, observation count, and last-sale recency."
    ],
    riskFlags,
    inputs: {
      officialConfidence: input.confidence,
      sourceCount: input.sourceCount ?? null,
      observationCount: input.observationCount ?? null,
      lastSaleAt: input.lastSaleAt ?? null
    }
  });

  const activityVelocity = result({
    value: Math.max(activity, recency * 0.8),
    reasons: ["Activity velocity uses official recent trades and last-sale recency."],
    riskFlags: activity === 0 ? [...riskFlags, "trade_activity_missing"] : riskFlags,
    inputs: {
      tradeCount: input.trades?.length ?? 0,
      lastSaleAt: input.lastSaleAt ?? null
    }
  });

  const sourceConfidence = result({
    value: Math.max(breakdown, sources * 0.65 + totalObservations * 0.35),
    reasons: ["Source confidence uses official source breakdown and all-time observation depth."],
    riskFlags,
    inputs: {
      sourceBreakdownCount: input.sourceBreakdown?.length ?? 0,
      sourceCount: input.sourceCount ?? null,
      totalObservationCount: input.totalObservationCount ?? null
    }
  });

  const liquidity = result({
    value: activity * 0.35 + sources * 0.2 + observations * 0.2 + fmvDepth * 0.15 + official * 0.1,
    reasons: ["Liquidity combines official trades, source breadth, observations, FMV-series depth, and confidence."],
    riskFlags,
    inputs: {
      tradeCount: input.trades?.length ?? 0,
      sourceCount: input.sourceCount ?? null,
      observationCount: input.observationCount ?? null,
      fmvPointCount: input.fmvSeries?.length ?? 0,
      confidence: input.confidence
    }
  });

  const deal = result({
    value: priceConfidence.value * 0.45 + liquidity.value * 0.35 + sourceConfidence.value * 0.2,
    reasons: [
      "Deal readiness is evidence quality for an informational memo, not a price prediction or trade instruction."
    ],
    riskFlags,
    inputs: {
      priceConfidence: priceConfidence.value,
      liquidity: liquidity.value,
      sourceConfidence: sourceConfidence.value
    }
  });

  return {
    scores: {
      activity_velocity: stored({ cardId: input.cardId, scoreType: "activity_velocity", computedAt, score: activityVelocity }),
      price_confidence: stored({ cardId: input.cardId, scoreType: "price_confidence", computedAt, score: priceConfidence }),
      source_confidence: stored({
        cardId: input.cardId,
        scoreType: "source_confidence",
        computedAt,
        score: sourceConfidence
      }),
      liquidity: stored({ cardId: input.cardId, scoreType: "liquidity", computedAt, score: liquidity }),
      deal: stored({ cardId: input.cardId, scoreType: "deal", computedAt, score: deal })
    }
  };
}
