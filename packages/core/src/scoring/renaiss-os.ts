import type { RiskFlag } from "../constants/risk-flags.js";
import type { RenaissOsConfidence, RenaissOsTradeKind } from "../schemas/renaiss-os.schema.js";
import { hashPayload } from "../utils/hash.js";
import type {
  DeterministicScoreInputsByType,
  DeterministicStoredScore,
  ScoreConfidence,
  StoredCardScoreType
} from "./deterministic.js";

export type RenaissOsTradeSignal = {
  observedAt: Date | string;
  kind: RenaissOsTradeKind;
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
  scores: {
    [ScoreType in StoredCardScoreType]: DeterministicStoredScore<ScoreType>;
  };
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

function scoreConfidence(value: number, confidenceRiskFlags: readonly RiskFlag[]): ScoreConfidence {
  if (
    confidenceRiskFlags.includes("official_confidence_low") ||
    confidenceRiskFlags.includes("official_observations_missing")
  ) {
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
  const recentTransactions = transactions.filter(
    (trade) => (ageDays(trade.observedAt, now) ?? 999) <= 30
  );
  const recentListings = listings.filter((trade) => (ageDays(trade.observedAt, now) ?? 999) <= 30);

  return clamp(
    recentTransactions.length * 18 + recentListings.length * 8 + transactions.length * 4
  );
}

function fmvDepthScore(points: readonly RenaissOsFmvPointSignal[]): number {
  const observations = points.reduce((sum, point) => sum + point.n, 0);
  return clamp(points.length * 5 + observations * 3);
}

function sourceBreakdownScore(sourceBreakdown: readonly RenaissOsSourceBreakdownSignal[]): number {
  const sourceCount = new Set(sourceBreakdown.map((entry) => entry.source)).size;
  const categoryCount = new Set(sourceBreakdown.map((entry) => entry.category).filter(Boolean))
    .size;
  const observations = sourceBreakdown.reduce((sum, entry) => sum + entry.count, 0);
  return clamp(sourceCount * 18 + categoryCount * 8 + observations * 2);
}

function stored<ScoreType extends StoredCardScoreType>(input: {
  cardId: string;
  scoreType: ScoreType;
  computedAt: string;
  value: number;
  reasons: string[];
  riskFlags: RiskFlag[];
  confidenceRiskFlags?: RiskFlag[];
  inputs: DeterministicScoreInputsByType[ScoreType];
}): DeterministicStoredScore<ScoreType> {
  const score = {
    value: roundScore(input.value),
    confidence: scoreConfidence(input.value, input.confidenceRiskFlags ?? input.riskFlags),
    reasons: input.reasons,
    riskFlags: input.riskFlags,
    inputs: input.inputs
  };

  return {
    entityType: "card",
    entityId: input.cardId,
    scoreType: input.scoreType,
    ...score,
    inputsHash: hashPayload({
      scoreType: input.scoreType,
      cardId: input.cardId,
      inputs: score.inputs
    }),
    computedAt: input.computedAt
  };
}

export function scoreRenaissOsCard(input: RenaissOsCardScoringInput): RenaissOsCardScoreSet {
  const now = input.now ?? new Date();
  const computedAt = now.toISOString();
  const effectiveRecencyAt = toDate(input.lastSaleAt ?? input.updatedAt)?.toISOString() ?? null;
  const official = officialConfidenceScore(input.confidence);
  const sources = sourceCoverage(input.sourceCount);
  const observations = observationCoverage(input.observationCount);
  const totalObservations = observationCoverage(input.totalObservationCount);
  const recency = recencyScore(input.lastSaleAt ?? input.updatedAt, now);
  const activity = tradeActivityScore(input.trades ?? [], now);
  const fmvDepth = fmvDepthScore(input.fmvSeries ?? []);
  const priceCoverage = Math.max(observations, fmvDepth);
  const breakdown = sourceBreakdownScore(input.sourceBreakdown ?? []);
  const fmvRiskFlags: RiskFlag[] = [];
  const coverageRiskFlags: RiskFlag[] = [];
  const activityRiskFlags: RiskFlag[] = [];
  const liquidityRiskFlags: RiskFlag[] = [];

  if (input.confidence === "low" || input.confidence == null)
    fmvRiskFlags.push("official_confidence_low");
  if ((input.observationCount ?? 0) === 0 && (input.fmvSeries?.length ?? 0) === 0) {
    fmvRiskFlags.push("official_observations_missing");
  }
  if ((input.sourceCount ?? 0) <= 1 && (input.sourceBreakdown?.length ?? 0) <= 1)
    coverageRiskFlags.push("single_source_evidence");
  if (ageDays(input.lastSaleAt, now) != null && (ageDays(input.lastSaleAt, now) ?? 0) > 90) {
    fmvRiskFlags.push("stale_last_sale");
    activityRiskFlags.push("stale_last_sale");
    liquidityRiskFlags.push("stale_last_sale");
  }
  if (activity === 0) {
    activityRiskFlags.push("trade_activity_missing");
    liquidityRiskFlags.push("trade_activity_missing");
  }

  const priceConfidence = stored({
    cardId: input.cardId,
    scoreType: "price_confidence",
    computedAt,
    value:
      official * 0.25 +
      sources * 0.12 +
      priceCoverage * 0.28 +
      fmvDepth * 0.2 +
      recency * 0.1 +
      activity * 0.05,
    reasons: [
      "Atlas computes FMV reliability from Renaiss confidence, FMV depth, trade activity, and last-sale recency."
    ],
    riskFlags: [...fmvRiskFlags, ...coverageRiskFlags],
    confidenceRiskFlags: fmvRiskFlags,
    inputs: {
      officialConfidence: input.confidence,
      sourceCount: input.sourceCount ?? null,
      observationCount: input.observationCount ?? null,
      fmvPointCount: input.fmvSeries?.length ?? 0,
      fmvDepthScore: fmvDepth,
      priceCoverageScore: priceCoverage,
      tradeActivityScore: activity,
      effectiveRecencyAt,
      recencyScore: recency
    }
  });

  const activityVelocity = stored({
    cardId: input.cardId,
    scoreType: "activity_velocity",
    computedAt,
    value: Math.max(activity, recency * 0.8),
    reasons: [
      "Atlas computes market activity from Renaiss trades, listings, and last-sale recency."
    ],
    riskFlags: activityRiskFlags,
    inputs: {
      tradeCount: input.trades?.length ?? 0,
      tradeActivityScore: activity,
      effectiveRecencyAt,
      recencyScore: recency
    }
  });

  const sourceConfidence = stored({
    cardId: input.cardId,
    scoreType: "source_confidence",
    computedAt,
    value: Math.max(breakdown, sources * 0.65 + totalObservations * 0.35),
    reasons: ["Atlas computes data depth from Renaiss record coverage."],
    riskFlags: coverageRiskFlags,
    inputs: {
      sourceBreakdownCount: input.sourceBreakdown?.length ?? 0,
      sourceBreakdownScore: breakdown,
      sourceCount: input.sourceCount ?? null,
      totalObservationCount: input.totalObservationCount ?? null
    }
  });

  const liquidity = stored({
    cardId: input.cardId,
    scoreType: "liquidity",
    computedAt,
    value:
      activity * 0.45 +
      fmvDepth * 0.25 +
      recency * 0.1 +
      sources * 0.08 +
      observations * 0.07 +
      official * 0.05,
    reasons: [
      "Atlas computes liquidity from Renaiss trade activity, FMV history depth, and recency."
    ],
    riskFlags: liquidityRiskFlags,
    inputs: {
      tradeCount: input.trades?.length ?? 0,
      tradeActivityScore: activity,
      sourceCount: input.sourceCount ?? null,
      observationCount: input.observationCount ?? null,
      fmvPointCount: input.fmvSeries?.length ?? 0,
      fmvDepthScore: fmvDepth,
      effectiveRecencyAt,
      recencyScore: recency,
      confidence: input.confidence
    }
  });

  return {
    scores: {
      activity_velocity: activityVelocity,
      price_confidence: priceConfidence,
      source_confidence: sourceConfidence,
      liquidity
    }
  };
}
