export type ScoreConfidence = "low" | "medium" | "high";

export type StoredCardScoreType =
  | "activity_velocity"
  | "liquidity"
  | "price_confidence"
  | "source_confidence";

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
