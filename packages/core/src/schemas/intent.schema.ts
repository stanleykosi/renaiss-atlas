import { z } from "zod";

export const IntentTypeSchema = z.enum(["buy", "sell", "bundle", "trade", "watch", "quest"]);
export const IntentStatusSchema = z.enum(["active", "expired", "closed", "hidden"]);

export const IntentSchema = z.object({
  id: z.string().uuid(),
  creatorAlias: z.string().nullable().optional(),
  creatorWallet: z.string().nullable().optional(),
  creatorDiscordId: z.string().nullable().optional(),
  intentType: IntentTypeSchema,
  queryText: z.string().min(3).max(500),
  tcg: z.string().nullable().optional(),
  characterName: z.string().nullable().optional(),
  setName: z.string().nullable().optional(),
  cardNumber: z.string().nullable().optional(),
  grader: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  minYear: z.number().int().min(1800).max(2200).nullable().optional(),
  maxYear: z.number().int().min(1800).max(2200).nullable().optional(),
  minPriceUsd: z.string().regex(/^(0|[1-9]\d*)(\.\d+)?$/).nullable().optional(),
  maxPriceUsd: z.string().regex(/^(0|[1-9]\d*)(\.\d+)?$/).nullable().optional(),
  requiresSerialAdjacency: z.boolean(),
  requiresExternalComp: z.boolean(),
  minLiquidityScore: z.number().min(0).max(100).nullable().optional(),
  status: IntentStatusSchema,
  expiresAt: z.string().datetime().nullable().optional()
});

export const CreateIntentInputSchema = IntentSchema.omit({
  id: true,
  status: true
}).extend({
  status: IntentStatusSchema.optional()
});

export type IntentType = z.infer<typeof IntentTypeSchema>;
export type IntentStatus = z.infer<typeof IntentStatusSchema>;
export type Intent = z.infer<typeof IntentSchema>;
export type CreateIntentInput = z.infer<typeof CreateIntentInputSchema>;

