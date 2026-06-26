import { z } from "zod";

const nullableUsdNumber = z.number().nonnegative().nullable().optional();

export const ExternalCompPlatformSchema = z.enum(["snkrdunk", "pricecharting", "manual", "mock"]);

export const ExternalPriceSnapshotSchema = z.object({
  tokenId: z.string().min(1),
  platform: ExternalCompPlatformSchema,
  productTitle: z.string().optional(),
  productUrl: z.string().url().optional(),
  currency: z.string().min(3).max(8).default("USD"),
  currentPriceUsd: nullableUsdNumber,
  lastSaleUsd: nullableUsdNumber,
  averagePriceUsd: nullableUsdNumber,
  volume30d: z.number().int().nonnegative().nullable().optional(),
  gradeMatched: z.boolean().nullable().optional(),
  languageMatched: z.boolean().nullable().optional(),
  cardNumberMatched: z.boolean().nullable().optional(),
  matchConfidence: z.number().min(0).max(100),
  matchReasons: z.array(z.string().min(1)),
  rejected: z.boolean(),
  rejectionReason: z.string().nullable().optional(),
  fetchedAt: z.string().datetime()
});

export type ExternalCompPlatform = z.infer<typeof ExternalCompPlatformSchema>;
export type ExternalPriceSnapshot = z.infer<typeof ExternalPriceSnapshotSchema>;

