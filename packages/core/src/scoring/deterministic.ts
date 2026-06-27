import { hashPayload } from "../utils/hash.js";

export type ScoreConfidence = "low" | "medium" | "high";

export type ComponentScoreType = "activity_velocity" | "offer_depth" | "price_consensus";

export type StoredCardScoreType =
  | ComponentScoreType
  | "liquidity"
  | "deal"
  | "price_confidence"
  | "external_comp_confidence"
  | "listing_health"
  | "demand"
  | "collector_premium"
  | "collateral_readiness";

export type DeterministicScoreResult = {
  value: number;
  confidence: ScoreConfidence;
  reasons: string[];
  riskFlags: string[];
  inputs: Record<string, unknown>;
};

export type DeterministicStoredScore = DeterministicScoreResult & {
  entityType: "card";
  entityId: string;
  scoreType: StoredCardScoreType;
  inputsHash: string;
  computedAt: string;
};

export type ExternalCompInput = {
  priceUsd?: number | null;
  averagePriceUsd?: number | null;
  matchConfidence?: number | null;
  rejected?: boolean;
  fetchedAt?: Date | string | null;
};

export type IntentMatchInput = {
  matchScore: number;
  createdAt?: Date | string | null;
};

export type DeterministicCardScoringInput = {
  tokenId: string;
  status: "listed" | "unlisted" | "unknown";
  askPriceUsd?: number | null;
  fmvUsd?: number | null;
  offerPriceUsd?: number | null;
  topOfferUsd?: number | null;
  lastSaleUsd?: number | null;
  buybackBaseValueUsd?: number | null;
  observedAt?: Date | string | null;
  lastSaleAt?: Date | string | null;
  askChangedAt?: Date | string | null;
  externalComps?: ExternalCompInput[];
  intentMatches?: IntentMatchInput[];
  adjacentCertExists?: boolean;
  sameCharacterBundleExists?: boolean;
  sameSetBundleExists?: boolean;
  packOriginStory?: boolean;
  highFmvPercentile?: boolean;
  grade?: string | null;
  mockData?: boolean;
  now?: Date;
};

export type DeterministicCardScoreSet = {
  components: Record<ComponentScoreType, DeterministicScoreResult>;
  scores: Record<StoredCardScoreType, DeterministicStoredScore>;
};

const confidenceWeight: Record<ScoreConfidence, number> = {
  high: 1,
  medium: 0.7,
  low: 0.4
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

function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  const middleValue = sorted[middle];
  if (middleValue == null) return null;
  if (sorted.length % 2 === 1) return middleValue;
  const leftValue = sorted[middle - 1];
  return leftValue == null ? middleValue : (leftValue + middleValue) / 2;
}

function combineReasons(...scores: DeterministicScoreResult[]): string[] {
  return [...new Set(scores.flatMap((score) => score.reasons))];
}

function combineRiskFlags(...scores: DeterministicScoreResult[]): string[] {
  return [...new Set(scores.flatMap((score) => score.riskFlags))];
}

function confidenceFromValue(value: number, riskFlags: readonly string[]): ScoreConfidence {
  if (
    riskFlags.some((flag) =>
      ["stale_renaiss_data", "external_comp_mismatch", "activity_data_missing", "fmv_missing"].includes(
        flag
      )
    )
  ) {
    return value >= 45 ? "medium" : "low";
  }
  if (value >= 75) return "high";
  if (value >= 45) return "medium";
  return "low";
}

function acceptedExternalPrices(input: DeterministicCardScoringInput): number[] {
  return (input.externalComps ?? [])
    .filter((comp) => comp.rejected !== true)
    .map((comp) => comp.priceUsd ?? comp.averagePriceUsd ?? null)
    .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
}

function rejectedExternalCount(input: DeterministicCardScoringInput): number {
  return (input.externalComps ?? []).filter((comp) => comp.rejected === true).length;
}

export function scoreActivityVelocity(input: DeterministicCardScoringInput): DeterministicScoreResult {
  const now = input.now ?? new Date();
  const lastSaleAge = ageDays(input.lastSaleAt, now);
  const askChangedAge = ageDays(input.askChangedAt ?? input.observedAt, now);
  const riskFlags: string[] = [];
  const reasons: string[] = [];
  let value = 25;

  if (lastSaleAge != null && lastSaleAge <= 7) {
    value = 100;
    reasons.push("Last sale is within 7 days.");
  } else if (lastSaleAge != null && lastSaleAge <= 30) {
    value = 80;
    reasons.push("Last sale is within 30 days.");
  } else if (lastSaleAge != null || input.lastSaleUsd != null) {
    value = 55;
    reasons.push("Last sale evidence exists.");
  } else if (input.status === "listed" && askChangedAge != null && askChangedAge <= 7) {
    value = 45;
    reasons.push("Listed with recent observed ask data.");
  } else if (input.status === "listed") {
    value = 35;
    reasons.push("Card is listed but recent activity is limited.");
  } else if (input.status === "unlisted") {
    value = 15;
    reasons.push("Card is unlisted with no recent activity.");
  } else {
    riskFlags.push("activity_data_missing");
    reasons.push("Activity data is missing.");
  }

  if (input.mockData === true) riskFlags.push("mock_data");

  return {
    value: roundScore(value),
    confidence: confidenceFromValue(value, riskFlags),
    reasons,
    riskFlags,
    inputs: { lastSaleAge, askChangedAge, status: input.status }
  };
}

export function scoreOfferDepth(input: DeterministicCardScoringInput): DeterministicScoreResult {
  const riskFlags: string[] = [];
  const reasons: string[] = [];
  let value = 20;

  if (input.topOfferUsd != null && input.fmvUsd != null && input.fmvUsd > 0) {
    value = clamp((input.topOfferUsd / input.fmvUsd) * 100);
    reasons.push("Top offer is compared against FMV.");
  } else if (input.offerPriceUsd != null && input.fmvUsd != null && input.fmvUsd > 0) {
    value = clamp((input.offerPriceUsd / input.fmvUsd) * 80);
    reasons.push("Offer price is compared against FMV.");
  } else {
    riskFlags.push("no_top_offer");
    reasons.push("No usable top offer is available.");
  }

  if (input.askPriceUsd != null && input.topOfferUsd != null && input.askPriceUsd > 0) {
    if (input.topOfferUsd / input.askPriceUsd >= 0.9) {
      value += 10;
      reasons.push("Top offer is within 90% of ask.");
    }
  }

  if (input.fmvUsd != null && input.topOfferUsd != null && input.fmvUsd > 0 && input.topOfferUsd / input.fmvUsd < 0.5) {
    riskFlags.push("offer_far_below_fmv");
  }

  return {
    value: roundScore(value),
    confidence: confidenceFromValue(value, riskFlags),
    reasons,
    riskFlags,
    inputs: {
      askPriceUsd: input.askPriceUsd,
      fmvUsd: input.fmvUsd,
      offerPriceUsd: input.offerPriceUsd,
      topOfferUsd: input.topOfferUsd
    }
  };
}

export function scorePriceConsensus(input: DeterministicCardScoringInput): DeterministicScoreResult {
  const riskFlags: string[] = [];
  const reasons: string[] = [];
  const externalMedian = median(acceptedExternalPrices(input));
  let value = 20;

  if (input.fmvUsd != null && externalMedian != null && externalMedian > 0) {
    const disagreement = Math.abs(input.fmvUsd - externalMedian) / externalMedian;
    value = 100 - clamp(disagreement * 100);
    reasons.push("Renaiss FMV is compared with accepted external comps.");
  } else if (input.fmvUsd != null && input.lastSaleUsd != null && input.fmvUsd > 0) {
    const disagreement = Math.abs(input.fmvUsd - input.lastSaleUsd) / input.fmvUsd;
    value = 80 - clamp(disagreement * 80);
    reasons.push("Renaiss FMV is compared with last sale.");
  } else if (input.fmvUsd != null) {
    value = 55;
    riskFlags.push("external_comp_missing");
    reasons.push("FMV exists, but accepted external comps are missing.");
  } else {
    riskFlags.push("fmv_missing");
    reasons.push("FMV is missing.");
  }

  if (rejectedExternalCount(input) > 0) {
    riskFlags.push("external_comp_mismatch");
  }

  return {
    value: roundScore(value),
    confidence: confidenceFromValue(value, riskFlags),
    reasons,
    riskFlags,
    inputs: { fmvUsd: input.fmvUsd, lastSaleUsd: input.lastSaleUsd, externalMedian }
  };
}

export function scoreListingHealth(input: DeterministicCardScoringInput): DeterministicScoreResult {
  const riskFlags: string[] = [];
  const reasons: string[] = [];
  let value = 35;

  if (input.status === "listed" && input.askPriceUsd != null && input.fmvUsd != null && input.fmvUsd > 0) {
    const askRatio = input.askPriceUsd / input.fmvUsd;
    if (askRatio >= 0.9 && askRatio <= 1.1) {
      value = 100;
      reasons.push("Ask is within 10% of FMV.");
    } else if (askRatio >= 0.75 && askRatio < 0.9) {
      value = 90;
      reasons.push("Ask is modestly below FMV.");
    } else if (askRatio > 1.1 && askRatio <= 1.3) {
      value = 65;
      reasons.push("Ask is above FMV but still near market range.");
    } else if (askRatio < 0.75) {
      value = 75;
      riskFlags.push("possible_stale_fmv");
      reasons.push("Ask is far below FMV; verify FMV freshness.");
    } else {
      value = 35;
      reasons.push("Ask is far above FMV.");
    }
  } else if (input.status === "listed") {
    value = 50;
    riskFlags.push(input.askPriceUsd == null ? "ask_missing" : "fmv_missing");
    reasons.push("Listing exists but price fields are incomplete.");
  } else {
    riskFlags.push("unlisted_card");
    reasons.push("Card is not listed.");
  }

  return {
    value: roundScore(value),
    confidence: confidenceFromValue(value, riskFlags),
    reasons,
    riskFlags,
    inputs: { askPriceUsd: input.askPriceUsd, fmvUsd: input.fmvUsd, status: input.status }
  };
}

export function scoreDemand(input: DeterministicCardScoringInput): DeterministicScoreResult {
  const now = input.now ?? new Date();
  const intentSignal = Math.min(
    100,
    (input.intentMatches ?? []).reduce((sum, match) => {
      const days = ageDays(match.createdAt, now);
      const weight = days == null ? 0.4 : days <= 7 ? 1 : days <= 30 ? 0.7 : 0.4;
      return sum + match.matchScore * weight;
    }, 0) / 2
  );
  const topOfferSignal =
    input.topOfferUsd != null && input.fmvUsd != null && input.fmvUsd > 0
      ? clamp((input.topOfferUsd / input.fmvUsd) * 100)
      : 20;
  const recentActivitySignal = scoreActivityVelocity(input).value;
  const value = 0.45 * intentSignal + 0.25 * topOfferSignal + 0.15 * recentActivitySignal;
  const riskFlags = input.intentMatches == null || input.intentMatches.length === 0 ? ["intent_data_missing"] : [];

  return {
    value: roundScore(value),
    confidence: confidenceFromValue(value, riskFlags),
    reasons:
      input.intentMatches == null || input.intentMatches.length === 0
        ? ["No structured active intent matches are available."]
        : ["Structured active intent matches support demand."],
    riskFlags,
    inputs: { intentSignal, topOfferSignal, recentActivitySignal }
  };
}

export function scoreCollectorPremium(input: DeterministicCardScoringInput): DeterministicScoreResult {
  const reasons: string[] = [];
  let value = 0;

  if (input.adjacentCertExists === true) {
    value += 35;
    reasons.push("Adjacent certification relationship exists.");
  }
  if (input.sameCharacterBundleExists === true) {
    value += 20;
    reasons.push("Same-character bundle relationship exists.");
  }
  if (input.sameSetBundleExists === true) {
    value += 15;
    reasons.push("Same-set bundle relationship exists.");
  }
  if (input.packOriginStory === true) {
    value += 10;
    reasons.push("Pack-origin story is present.");
  }
  if (["10", "black label", "pristine"].includes((input.grade ?? "").toLowerCase())) {
    value += 10;
    reasons.push("High grade adds collector appeal.");
  }
  if (input.highFmvPercentile === true) {
    value += 10;
    reasons.push("FMV is in a higher-value percentile.");
  }
  if (reasons.length === 0) reasons.push("No collector premium signals detected.");

  return {
    value: roundScore(value),
    confidence: value >= 50 ? "high" : value >= 20 ? "medium" : "low",
    reasons,
    riskFlags: [],
    inputs: {
      adjacentCertExists: input.adjacentCertExists,
      sameCharacterBundleExists: input.sameCharacterBundleExists,
      sameSetBundleExists: input.sameSetBundleExists,
      packOriginStory: input.packOriginStory,
      grade: input.grade
    }
  };
}

export function scoreExternalCompConfidence(input: DeterministicCardScoringInput): DeterministicScoreResult {
  const accepted = acceptedExternalPrices(input);
  const externalMedian = median(accepted);
  const rejected = rejectedExternalCount(input);
  const riskFlags: string[] = [];
  const reasons: string[] = [];
  let value = 20;

  if (accepted.length >= 2 && input.fmvUsd != null && externalMedian != null && externalMedian > 0) {
    const disagreement = Math.abs(input.fmvUsd - externalMedian) / externalMedian;
    value = disagreement <= 0.15 ? 90 : 65;
    reasons.push("Multiple accepted external comps are available.");
  } else if (accepted.length >= 1 && rejected === 0) {
    value = 60;
    reasons.push("One accepted external comp is available.");
  } else if (accepted.length >= 1) {
    value = 45;
    riskFlags.push("external_comp_mismatch");
    reasons.push("Accepted comps exist but rejected mismatch evidence is also present.");
  } else {
    riskFlags.push(rejected > 0 ? "external_comp_mismatch" : "external_comp_missing");
    reasons.push("No accepted external comps are available.");
  }

  return {
    value: roundScore(value),
    confidence: value >= 75 && riskFlags.length === 0 ? "high" : value >= 45 ? "medium" : "low",
    reasons,
    riskFlags,
    inputs: { acceptedCount: accepted.length, rejected, externalMedian }
  };
}

export function scorePriceConfidence(input: DeterministicCardScoringInput): DeterministicScoreResult {
  const now = input.now ?? new Date();
  const ageHours = ageDays(input.observedAt, now);
  const sourceFreshnessScore =
    ageHours == null
      ? 0
      : ageHours * 24 <= 0.5
        ? 100
        : ageHours * 24 <= 2
          ? 80
          : ageHours <= 1
            ? 50
            : 20;
  const consensus = scorePriceConsensus(input);
  const internalCompleteness =
    (input.fmvUsd != null ? 35 : 0) +
    (input.askPriceUsd != null ? 25 : 0) +
    (input.topOfferUsd != null ? 20 : 0) +
    (input.lastSaleUsd != null ? 20 : 0);
  const external = scoreExternalCompConfidence(input);
  const value =
    0.35 * sourceFreshnessScore +
    0.3 * consensus.value +
    0.2 * internalCompleteness +
    0.15 * external.value;
  const riskFlags = combineRiskFlags(consensus, external);
  if (sourceFreshnessScore <= 20) riskFlags.push("stale_renaiss_data");

  return {
    value: roundScore(value),
    confidence: confidenceFromValue(value, riskFlags),
    reasons: [
      "Price confidence combines source freshness, price agreement, completeness, and match quality.",
      ...combineReasons(consensus, external)
    ],
    riskFlags: [...new Set(riskFlags)],
    inputs: { sourceFreshnessScore, internalCompleteness, consensus: consensus.value, external: external.value }
  };
}

export function scoreLiquidity(input: DeterministicCardScoringInput): DeterministicScoreResult {
  const activity = scoreActivityVelocity(input);
  const offerDepth = scoreOfferDepth(input);
  const consensus = scorePriceConsensus(input);
  const listing = scoreListingHealth(input);
  const demand = scoreDemand(input);
  const premium = scoreCollectorPremium(input);
  const value =
    0.3 * activity.value +
    0.2 * offerDepth.value +
    0.2 * consensus.value +
    0.15 * listing.value +
    0.1 * demand.value +
    0.05 * premium.value;
  const riskFlags = combineRiskFlags(activity, offerDepth, consensus, listing, demand, premium);

  return {
    value: roundScore(value),
    confidence: confidenceFromValue(value, riskFlags),
    reasons: ["Liquidity combines activity, offers, consensus, listing health, demand, and premium."],
    riskFlags,
    inputs: {
      activityVelocity: activity.value,
      offerDepth: offerDepth.value,
      priceConsensus: consensus.value,
      listingHealth: listing.value,
      demand: demand.value,
      collectorPremium: premium.value
    }
  };
}

export function scoreDeal(input: DeterministicCardScoringInput): DeterministicScoreResult {
  const liquidity = scoreLiquidity(input);
  const priceConfidence = scorePriceConfidence(input);
  const externalMedian = median(acceptedExternalPrices(input));
  const discounts = [];
  if (input.askPriceUsd != null && input.fmvUsd != null && input.fmvUsd > 0) {
    discounts.push((input.fmvUsd - input.askPriceUsd) / input.fmvUsd);
  }
  if (input.askPriceUsd != null && externalMedian != null && externalMedian > 0) {
    discounts.push((externalMedian - input.askPriceUsd) / externalMedian);
  }
  const bestSupportedDiscount = discounts.length === 0 ? 0 : discounts.reduce((sum, value) => sum + value, 0) / discounts.length;
  const riskFlags = combineRiskFlags(liquidity, priceConfidence);
  let riskPenalty = 0;
  if (riskFlags.includes("external_comp_missing")) riskPenalty += 10;
  if (riskFlags.includes("external_comp_mismatch")) riskPenalty += 30;
  if (riskFlags.includes("fmv_missing")) riskPenalty += 25;
  if (liquidity.value < 40) {
    riskPenalty += 20;
    riskFlags.push("low_liquidity");
  }
  if (riskFlags.includes("stale_renaiss_data")) riskPenalty += 25;
  if (input.askPriceUsd != null && input.fmvUsd != null && input.fmvUsd > 0 && input.askPriceUsd / input.fmvUsd < 0.25) {
    riskPenalty += 15;
    riskFlags.push("ask_extremely_low_vs_fmv");
  }

  const confidenceMultiplier = confidenceWeight[priceConfidence.confidence];
  const liquidityBonus = liquidity.value >= 70 ? 10 : liquidity.value >= 50 ? 5 : 0;
  const value = bestSupportedDiscount * 100 * confidenceMultiplier + liquidityBonus - riskPenalty;

  return {
    value: roundScore(value),
    confidence: confidenceFromValue(value, riskFlags),
    reasons:
      bestSupportedDiscount > 0
        ? ["Ask is discounted against supported value evidence."]
        : ["No supported positive discount is available."],
    riskFlags: [...new Set(riskFlags)],
    inputs: { bestSupportedDiscount, confidenceMultiplier, liquidityBonus, riskPenalty, externalMedian }
  };
}

export function scoreCollateralReadiness(input: DeterministicCardScoringInput): DeterministicScoreResult {
  const liquidity = scoreLiquidity(input);
  const priceConfidence = scorePriceConfidence(input);
  const activity = scoreActivityVelocity(input);
  const external = scoreExternalCompConfidence(input);
  const value = Math.min(liquidity.value, priceConfidence.value, activity.value, external.value);
  const riskFlags = combineRiskFlags(liquidity, priceConfidence, activity, external);

  return {
    value: roundScore(value),
    confidence: confidenceFromValue(value, riskFlags),
    reasons: [
      "Collateral readiness is the minimum of liquidity, price confidence, activity, and external comp confidence.",
      "Experimental collateral-readiness signal. Not a loan offer, not a liquidation value, not financial advice."
    ],
    riskFlags,
    inputs: {
      liquidity: liquidity.value,
      priceConfidence: priceConfidence.value,
      activityVelocity: activity.value,
      externalCompConfidence: external.value
    }
  };
}

function storedScore(
  input: DeterministicCardScoringInput,
  scoreType: StoredCardScoreType,
  result: DeterministicScoreResult,
  computedAt: string
): DeterministicStoredScore {
  return {
    ...result,
    entityType: "card",
    entityId: input.tokenId,
    scoreType,
    inputsHash: hashPayload({ scoreType, inputs: result.inputs, tokenId: input.tokenId }),
    computedAt
  };
}

export function scoreCard(input: DeterministicCardScoringInput): DeterministicCardScoreSet {
  const computedAt = (input.now ?? new Date()).toISOString();
  const components = {
    activity_velocity: scoreActivityVelocity(input),
    offer_depth: scoreOfferDepth(input),
    price_consensus: scorePriceConsensus(input)
  };
  const stored: Record<StoredCardScoreType, DeterministicScoreResult> = {
    ...components,
    listing_health: scoreListingHealth(input),
    demand: scoreDemand(input),
    collector_premium: scoreCollectorPremium(input),
    liquidity: scoreLiquidity(input),
    deal: scoreDeal(input),
    price_confidence: scorePriceConfidence(input),
    external_comp_confidence: scoreExternalCompConfidence(input),
    collateral_readiness: scoreCollateralReadiness(input)
  };

  return {
    components,
    scores: Object.fromEntries(
      Object.entries(stored).map(([scoreType, result]) => [
        scoreType,
        storedScore(input, scoreType as StoredCardScoreType, result, computedAt)
      ])
    ) as Record<StoredCardScoreType, DeterministicStoredScore>
  };
}
