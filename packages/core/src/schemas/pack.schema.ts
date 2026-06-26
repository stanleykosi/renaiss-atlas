import { z } from "zod";

export const PackActivitySchema = z.object({
  activityId: z.string().min(1),
  packName: z.string().min(1),
  packSlug: z.string().min(1),
  tier: z.string().nullable().optional(),
  fmvUsd: z.string().regex(/^(0|[1-9]\d*)(\.\d+)?$/).nullable().optional(),
  psaId: z.string().nullable().optional(),
  frontImageUrl: z.string().url().nullable().optional(),
  pulledAt: z.string().datetime().nullable().optional(),
  firstSeenAt: z.string().datetime(),
  matchedTokenId: z.string().nullable().optional()
});

export type PackActivity = z.infer<typeof PackActivitySchema>;

