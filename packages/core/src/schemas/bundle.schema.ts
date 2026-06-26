import { z } from "zod";

import { ConfidenceLabelSchema } from "../constants/confidence.js";
import { CardListItemSchema } from "./card.schema.js";

export const BundleTypeSchema = z.enum([
  "sequential_cert_pair",
  "same_card",
  "same_character",
  "same_set",
  "same_pack_origin",
  "wallet_completion",
  "intent_driven",
  "custom"
]);

export const BundleSchema = z.object({
  id: z.string().uuid(),
  bundleType: BundleTypeSchema,
  name: z.string().min(1),
  summary: z.string().optional(),
  score: z.number().min(0).max(100),
  confidence: ConfidenceLabelSchema,
  reasons: z.array(z.string().min(1)),
  totalAskUsd: z.number().nonnegative().nullable().optional(),
  totalFmvUsd: z.number().nonnegative().nullable().optional(),
  totalExternalMedianUsd: z.number().nonnegative().nullable().optional(),
  items: z.array(CardListItemSchema).default([])
});

export type BundleType = z.infer<typeof BundleTypeSchema>;
export type Bundle = z.infer<typeof BundleSchema>;

