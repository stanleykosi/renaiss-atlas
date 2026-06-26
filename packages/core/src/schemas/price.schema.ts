import { z } from "zod";

import { SourceKindSchema } from "./source-ref.schema.js";

export const UsdDecimalStringSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)(\.\d+)?$/, "Expected a non-negative decimal string");

export const PriceRawUnitSchema = z.enum(["wei_usdt", "usd_cents", "usd", "unknown"]);

const nullableUsd = UsdDecimalStringSchema.nullable().optional();

export const CardPriceSnapshotSchema = z.object({
  tokenId: z.string().min(1),
  askPriceUsd: nullableUsd,
  askPriceRaw: z.string().nullable().optional(),
  askPriceRawUnit: PriceRawUnitSchema.nullable().optional(),
  fmvUsd: nullableUsd,
  fmvRaw: z.string().nullable().optional(),
  fmvRawUnit: PriceRawUnitSchema.nullable().optional(),
  offerPriceUsd: nullableUsd,
  topOfferUsd: nullableUsd,
  lastSaleUsd: nullableUsd,
  buybackBaseValueUsd: nullableUsd,
  isListed: z.boolean(),
  source: SourceKindSchema,
  sourceRecordId: z.string().min(1),
  observedAt: z.string().datetime()
});

export type UsdDecimalString = z.infer<typeof UsdDecimalStringSchema>;
export type PriceRawUnit = z.infer<typeof PriceRawUnitSchema>;
export type CardPriceSnapshot = z.infer<typeof CardPriceSnapshotSchema>;

