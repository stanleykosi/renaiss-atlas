import { z } from "zod";

import { ConfidenceLabelSchema } from "../constants/confidence.js";

export const ScoreEntityTypeSchema = z.enum(["card"]);

export const ScoreTypeSchema = z.enum([
  "activity_velocity",
  "liquidity",
  "deal",
  "price_confidence",
  "source_confidence"
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
