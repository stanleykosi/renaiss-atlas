import { z } from "zod";

import { ConfidenceLabelSchema } from "../constants/confidence.js";

export const ActionTypeSchema = z.enum([
  "LIST",
  "MAKE_OFFER",
  "BUNDLE",
  "WATCH",
  "AVOID",
  "CREATE_INTENT",
  "MATCH_INTENT",
  "QUEST",
  "SHARE"
]);

export const ActionSubjectTypeSchema = z.enum(["card", "wallet", "bundle", "intent", "pack"]);

export const ActionCtaSchema = z.object({
  label: z.string().min(1).max(80),
  href: z.string().min(1)
});

export const ActionRecommendationSchema = z.object({
  subjectType: ActionSubjectTypeSchema,
  subjectId: z.string().min(1),
  actionType: ActionTypeSchema,
  priority: z.number().int().min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  confidence: ConfidenceLabelSchema,
  impact: z.string().optional(),
  risks: z.array(z.string().min(1)),
  sourceIds: z.array(z.string().min(1)),
  cta: ActionCtaSchema.optional()
});

export type ActionType = z.infer<typeof ActionTypeSchema>;
export type ActionSubjectType = z.infer<typeof ActionSubjectTypeSchema>;
export type ActionCta = z.infer<typeof ActionCtaSchema>;
export type ActionRecommendation = z.infer<typeof ActionRecommendationSchema>;

