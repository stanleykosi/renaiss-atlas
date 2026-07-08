import { z } from "zod";

export const RISK_FLAGS = [
  "official_confidence_low",
  "official_observations_missing",
  "single_source_evidence",
  "stale_last_sale",
  "trade_activity_missing",
  "ai_fallback_used"
] as const;

export const RiskFlagSchema = z.enum(RISK_FLAGS);

export type RiskFlag = z.infer<typeof RiskFlagSchema>;
