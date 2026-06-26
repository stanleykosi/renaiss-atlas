import { z } from "zod";

import { ConfidenceLabelSchema } from "../constants/confidence.js";
import { ActionRecommendationSchema, ActionTypeSchema } from "./action.schema.js";
import { BundleSchema } from "./bundle.schema.js";
import { CardSchema } from "./card.schema.js";
import { FreshnessSchema, SourceRefSchema } from "./source-ref.schema.js";
import { ScoreSchema } from "./score.schema.js";

const WalletSummarySchema = z.object({
  address: z.string().min(1),
  totalCards: z.number().int().nonnegative(),
  listedCards: z.number().int().nonnegative(),
  unlistedCards: z.number().int().nonnegative(),
  totalFmvUsd: z.number().nonnegative().nullable().optional(),
  totalAskUsd: z.number().nonnegative().nullable().optional(),
  avgLiquidityScore: z.number().min(0).max(100).nullable().optional()
});

export const AiMemoInputSchema = z.object({
  subject: z.object({
    type: z.enum(["card", "wallet", "bundle", "intent", "pack"]),
    id: z.string().min(1)
  }),
  card: CardSchema.optional(),
  wallet: WalletSummarySchema.optional(),
  bundle: BundleSchema.optional(),
  scores: z.array(ScoreSchema),
  candidateActions: z.array(ActionRecommendationSchema),
  sources: z.array(SourceRefSchema),
  riskFlags: z.array(z.string().min(1)),
  freshness: z.array(FreshnessSchema),
  mockData: z.boolean().default(false)
});

export const AiMemoOutputSchema = z.object({
  recommendation: z.string().min(1).max(600),
  evidence: z.array(z.string().min(1).max(280)).min(1).max(6),
  risks: z.array(z.string().min(1).max(280)).min(1).max(6),
  confidence: ConfidenceLabelSchema,
  sourcesUsed: z.array(z.string().min(1)).min(1),
  nextAction: z.object({
    label: z.string().min(1).max(80),
    type: ActionTypeSchema
  }),
  disclaimer: z.string().min(1).max(300)
});

export type AiMemoInput = z.infer<typeof AiMemoInputSchema>;
export type AiMemoOutput = z.infer<typeof AiMemoOutputSchema>;
