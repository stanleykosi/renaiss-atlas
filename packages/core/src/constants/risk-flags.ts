import { z } from "zod";

export const RISK_FLAGS = [
  "fmv_missing",
  "ask_missing",
  "external_comp_missing",
  "external_comp_mismatch",
  "external_comp_stale",
  "low_match_confidence",
  "low_liquidity",
  "stale_renaiss_data",
  "activity_data_missing",
  "possible_stale_fmv",
  "price_outlier",
  "unlisted_card",
  "no_top_offer",
  "missing_serial",
  "serial_parse_failed",
  "mock_data",
  "ai_fallback_used",
  "observed_interval_not_official_odds"
] as const;

export const RiskFlagSchema = z.enum(RISK_FLAGS);

export type RiskFlag = z.infer<typeof RiskFlagSchema>;

