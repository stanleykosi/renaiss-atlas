import { z } from "zod";

import { ConfidenceLabelSchema } from "../constants/confidence.js";

export const SourceKindSchema = z.enum(["renaiss_os_index"]);

export const FreshnessStatusSchema = z.enum(["fresh", "stale", "missing"]);

export const SourceRefSchema = z.object({
  id: z.string().min(1),
  source: SourceKindSchema,
  sourceUrl: z.string().url().optional(),
  fetchedAt: z.string().datetime(),
  confidence: ConfidenceLabelSchema
});

export const FreshnessSchema = z.object({
  source: SourceKindSchema,
  observedAt: z.string().datetime().optional(),
  status: FreshnessStatusSchema,
  message: z.string().optional()
});

export type SourceKind = z.infer<typeof SourceKindSchema>;
export type SourceRef = z.infer<typeof SourceRefSchema>;
export type FreshnessStatus = z.infer<typeof FreshnessStatusSchema>;
export type Freshness = z.infer<typeof FreshnessSchema>;
