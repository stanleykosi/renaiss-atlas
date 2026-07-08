import { z } from "zod";

import { ConfidenceLabelSchema } from "../constants/confidence.js";
import { ActionRecommendationSchema, ActionTypeSchema } from "./action.schema.js";
import { CardSchema } from "./card.schema.js";
import { FreshnessSchema, SourceRefSchema } from "./source-ref.schema.js";
import { ScoreSchema } from "./score.schema.js";

export const AiMemoOfficialEvidenceSchema = z.object({
  confidence: z.enum(["prime", "high", "medium", "low"]).nullable(),
  lastSaleAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
  priceUsdCents: z.number().int().nonnegative().nullable(),
  tradeCount: z.number().int().nonnegative(),
  transactionCount: z.number().int().nonnegative(),
  listingCount: z.number().int().nonnegative(),
  fmvPointCount: z.number().int().nonnegative()
});

export const AiMemoInputSchema = z.object({
  subject: z.object({
    type: z.enum(["card"]),
    id: z.string().min(1)
  }),
  card: CardSchema,
  officialEvidence: AiMemoOfficialEvidenceSchema,
  scores: z.array(ScoreSchema),
  candidateActions: z.array(ActionRecommendationSchema),
  sources: z.array(SourceRefSchema),
  riskFlags: z.array(z.string().min(1)),
  freshness: z.array(FreshnessSchema),
  officialApi: z.literal(true).default(true)
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
export type AiMemoOfficialEvidence = z.infer<typeof AiMemoOfficialEvidenceSchema>;
