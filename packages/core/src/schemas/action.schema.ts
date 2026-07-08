import { z } from "zod";

import { ConfidenceLabelSchema } from "../constants/confidence.js";

export const ActionTypeSchema = z.enum([
  "WATCH",
  "REVIEW_SOURCES",
  "CHECK_CERT",
  "OPEN_RENAISS"
]);

export const ActionSubjectTypeSchema = z.enum(["card"]);

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
