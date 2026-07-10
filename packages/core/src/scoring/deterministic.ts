import type { ConfidenceLabel } from "../constants/confidence.js";
import type { RiskFlag } from "../constants/risk-flags.js";
import type { RenaissOsConfidence } from "../schemas/renaiss-os.schema.js";
import type { ScoreEntityType, ScoreType } from "../schemas/score.schema.js";

export type ScoreConfidence = ConfidenceLabel;

export type StoredCardScoreType = ScoreType;

export type DeterministicScoreInputsByType = {
  activity_velocity: {
    tradeCount: number;
    tradeActivityScore: number;
    effectiveRecencyAt: string | null;
    recencyScore: number;
  };
  liquidity: {
    tradeCount: number;
    tradeActivityScore: number;
    sourceCount: number | null;
    observationCount: number | null;
    fmvPointCount: number;
    fmvDepthScore: number;
    effectiveRecencyAt: string | null;
    recencyScore: number;
    confidence: RenaissOsConfidence;
  };
  price_confidence: {
    officialConfidence: RenaissOsConfidence;
    sourceCount: number | null;
    observationCount: number | null;
    fmvPointCount: number;
    fmvDepthScore: number;
    priceCoverageScore: number;
    tradeActivityScore: number;
    effectiveRecencyAt: string | null;
    recencyScore: number;
  };
  source_confidence: {
    sourceBreakdownCount: number;
    sourceBreakdownScore: number;
    sourceCount: number | null;
    totalObservationCount: number | null;
  };
};

export type DeterministicScoreResult<ScoreType extends StoredCardScoreType = StoredCardScoreType> =
  {
    value: number;
    confidence: ScoreConfidence;
    reasons: string[];
    riskFlags: RiskFlag[];
    inputs: DeterministicScoreInputsByType[ScoreType];
  };

export type DeterministicStoredScore<ScoreType extends StoredCardScoreType = StoredCardScoreType> =
  DeterministicScoreResult<ScoreType> & {
    entityType: ScoreEntityType;
    entityId: string;
    scoreType: ScoreType;
    inputsHash: string;
    computedAt: string;
  };
