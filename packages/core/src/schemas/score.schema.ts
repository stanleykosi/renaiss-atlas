import { z } from "zod";

import { ConfidenceLabelSchema } from "../constants/confidence.js";

export const ScoreEntityTypeSchema = z.enum(["card", "wallet", "bundle", "intent", "pack"]);

export const ScoreTypeSchema = z.enum([
  "activity_velocity",
  "offer_depth",
  "price_consensus",
  "liquidity",
  "deal",
  "price_confidence",
  "external_comp_confidence",
  "listing_health",
  "demand",
  "bundle",
  "collector_premium",
  "collateral_readiness",
  "wallet_action_priority",
  "quest_suitability"
]);

export const ScoreSchema = z.object({
  entityType: ScoreEntityTypeSchema,
  entityId: z.string().min(1),
  scoreType: ScoreTypeSchema,
  scoreValue: z.number().min(0).max(100),
  confidence: ConfidenceLabelSchema,
  inputsHash: z.string().min(1),
  reasons: z.array(z.string().min(1)),
  riskFlags: z.array(z.string().min(1)),
  computedAt: z.string().datetime()
});

export type ScoreEntityType = z.infer<typeof ScoreEntityTypeSchema>;
export type ScoreType = z.infer<typeof ScoreTypeSchema>;
export type Score = z.infer<typeof ScoreSchema>;
