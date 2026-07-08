import { z } from "zod";

export const RenaissOsGameSchema = z.enum(["pokemon", "one-piece", "sports"]);
export const RenaissOsBucketSchema = z.enum(["public", "renaiss", "partner"]).nullable().optional();
export const RenaissOsCategorySchema = z
  .enum(["public", "blockchain", "renaiss", "partner", "internal"])
  .nullable()
  .optional();
export const RenaissOsCompanySchema = z.enum(["PSA", "BGS", "CGC", "SGC", "RAW", "TAG"]).nullable();
export const RenaissOsConfidenceSchema = z.enum(["prime", "high", "medium", "low"]).nullable();

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();
const nullableInt = z.number().int().nullable();
const dateString = z.string().datetime();

export const RenaissOsDeltasSchema = z
  .object({
    d7: nullableNumber,
    d30: nullableNumber,
    d365: nullableNumber
  })
  .passthrough();

export const RenaissOsSeriesPointSchema = z
  .object({
    t: dateString,
    usdCents: z.number().int().nonnegative(),
    source: nullableString.optional(),
    bucket: RenaissOsBucketSchema,
    category: RenaissOsCategorySchema,
    n: z.number().int().nonnegative().optional(),
    kind: z.enum(["transaction", "listing"]).nullable().optional(),
    company: RenaissOsCompanySchema.optional(),
    grade: nullableString.optional(),
    gradeLabel: z.string().optional()
  })
  .passthrough();

export const RenaissOsIndexMoverSchema = z
  .object({
    name: z.string(),
    setCode: nullableString,
    cardNumber: nullableString,
    grade: z.string(),
    href: z.string(),
    deltaPct: nullableNumber
  })
  .passthrough();

export const RenaissOsIndexTileSchema = z
  .object({
    game: RenaissOsGameSchema,
    label: z.string(),
    value: z.number(),
    base: z.number(),
    deltas: RenaissOsDeltasSchema,
    constituentCount: z.number().int().nonnegative(),
    rebalance: z.string(),
    sparkline: z.array(RenaissOsSeriesPointSchema),
    topMovers: z.array(RenaissOsIndexMoverSchema),
    updatedAt: dateString.nullable()
  })
  .passthrough();

export const RenaissOsIndicesResponseSchema = z
  .object({
    indices: z.array(RenaissOsIndexTileSchema)
  })
  .passthrough();

export const RenaissOsIndexConstituentSchema = z
  .object({
    rank: z.number().int().positive(),
    name: z.string(),
    setName: nullableString,
    setCode: nullableString,
    cardNumber: nullableString,
    grade: z.string(),
    imageUrl: nullableString,
    imageUrlThumb: nullableString.optional(),
    priceUsdCents: nullableInt,
    deltaPct: nullableNumber,
    lastSaleAt: dateString.nullable(),
    href: z.string()
  })
  .passthrough();

export const RenaissOsIndexDetailSchema = RenaissOsIndexTileSchema.extend({
  windowDays: z.number().int().positive(),
  baseDate: nullableString,
  constituents: z.array(RenaissOsIndexConstituentSchema)
}).passthrough();

export const RenaissOsCardSummarySchema = z
  .object({
    game: RenaissOsGameSchema,
    type: z.enum(["POKEMON", "ONE_PIECE", "SPORTS"]),
    name: z.string(),
    setName: nullableString,
    setCode: nullableString,
    cardNumber: nullableString,
    variation: nullableString,
    language: nullableString,
    imageUrl: nullableString,
    imageUrlThumb: nullableString.optional(),
    company: RenaissOsCompanySchema,
    grade: nullableString,
    gradeLabel: z.string(),
    priceUsdCents: nullableInt,
    deltaPct: nullableNumber,
    confidence: RenaissOsConfidenceSchema,
    lastSaleAt: dateString.nullable(),
    spark: z.array(z.number().int().nonnegative()).optional(),
    href: z.string()
  })
  .passthrough();

export const RenaissOsFeaturedResponseSchema = z
  .object({
    cards: z.array(RenaissOsCardSummarySchema)
  })
  .passthrough();

export const RenaissOsSourceBreakdownEntrySchema = z
  .object({
    source: z.string(),
    bucket: RenaissOsBucketSchema,
    category: RenaissOsCategorySchema,
    displayName: z.string(),
    count: z.number().int().nonnegative(),
    medianUsdCents: nullableInt,
    overviewUrl: nullableString
  })
  .passthrough();

export const RenaissOsFmvMethodValueSchema = z
  .object({
    method: z.enum(["median", "mean", "vwap"]),
    scorerVersion: z.string(),
    label: z.string(),
    priceUsdCents: nullableInt,
    confidence: RenaissOsConfidenceSchema,
    sourceCount: nullableInt,
    observationCount: nullableInt
  })
  .passthrough();

export const RenaissOsGradeRowSchema = z
  .object({
    company: RenaissOsCompanySchema,
    grade: nullableString,
    gradeLabel: z.string(),
    priceUsdCents: nullableInt,
    deltaPct: nullableNumber,
    confidence: RenaissOsConfidenceSchema,
    lastSaleAt: dateString.nullable(),
    href: z.string(),
    current: z.boolean()
  })
  .passthrough();

export const RenaissOsCardDetailSchema = z
  .object({
    id: z.string(),
    game: RenaissOsGameSchema,
    type: z.enum(["POKEMON", "ONE_PIECE", "SPORTS"]),
    name: z.string(),
    setName: nullableString,
    setCode: nullableString,
    cardNumber: nullableString,
    variation: nullableString,
    language: nullableString,
    imageUrl: nullableString,
    imageUrlLg: nullableString,
    company: RenaissOsCompanySchema,
    grade: nullableString,
    gradeLabel: z.string(),
    priceUsdCents: nullableInt,
    deltas: RenaissOsDeltasSchema,
    confidence: RenaissOsConfidenceSchema,
    sourceCount: nullableInt,
    observationCount: nullableInt,
    observationWindowDays: nullableInt,
    totalObservationCount: nullableInt,
    updatedAt: dateString.nullable(),
    lastSaleAt: dateString.nullable(),
    refreshing: z.boolean(),
    sourceBreakdown: z.array(RenaissOsSourceBreakdownEntrySchema),
    sourceBreakdownAllTime: z.array(RenaissOsSourceBreakdownEntrySchema),
    trackedSources: z.array(RenaissOsSourceBreakdownEntrySchema).optional(),
    methods: z.array(RenaissOsFmvMethodValueSchema),
    otherGrades: z.array(RenaissOsGradeRowSchema),
    similar: z.array(RenaissOsCardSummarySchema),
    href: z.string(),
    pageUrl: z.string()
  })
  .passthrough();

export const RenaissOsTradeRowSchema = z
  .object({
    source: z.string(),
    bucket: RenaissOsBucketSchema,
    category: RenaissOsCategorySchema,
    displayName: z.string(),
    observedAt: dateString,
    kind: z.enum(["listing", "transaction"]),
    priceUsdCents: nullableInt,
    priceMinor: nullableInt,
    currency: z.string(),
    detail: nullableString,
    sourceUrl: nullableString,
    company: RenaissOsCompanySchema,
    grade: nullableString,
    gradeLabel: nullableString
  })
  .passthrough();

export const RenaissOsTradesResponseSchema = z
  .object({
    trades: z.array(RenaissOsTradeRowSchema),
    total: z.number().int().nonnegative()
  })
  .passthrough();

export const RenaissOsRecentTradeSchema = RenaissOsTradeRowSchema.extend({
  id: z.string(),
  card: z
    .object({
      game: RenaissOsGameSchema,
      name: z.string(),
      grade: nullableString,
      gradeLabel: z.string(),
      setCode: nullableString,
      cardNumber: nullableString,
      href: z.string(),
      imageUrl: nullableString
    })
    .passthrough()
}).passthrough();

export const RenaissOsRecentTradesResponseSchema = z
  .object({
    trades: z.array(RenaissOsRecentTradeSchema)
  })
  .passthrough();

export const RenaissOsSeriesResponseSchema = z
  .object({
    windowDays: z.number().int().positive(),
    points: z.array(RenaissOsSeriesPointSchema)
  })
  .passthrough();

export const RenaissOsFmvSourcePointSchema = z
  .object({
    source: z.string(),
    bucket: RenaissOsBucketSchema,
    category: RenaissOsCategorySchema,
    displayName: z.string(),
    usdCents: z.number().int().nonnegative(),
    n: z.number().int().nonnegative()
  })
  .passthrough();

export const RenaissOsFmvSeriesPointSchema = z
  .object({
    t: dateString,
    usdCents: z.number().int().nonnegative(),
    n: z.number().int().nonnegative(),
    bySource: z.array(RenaissOsFmvSourcePointSchema)
  })
  .passthrough();

export const RenaissOsFmvMethodSeriesSchema = z
  .object({
    method: z.enum(["median", "mean", "vwap"]),
    scorerVersion: z.string(),
    label: z.string(),
    points: z.array(
      z
        .object({
          t: dateString,
          usdCents: z.number().int().nonnegative()
        })
        .passthrough()
    )
  })
  .passthrough();

export const RenaissOsFmvSeriesResponseSchema = z
  .object({
    windowDays: z.number().int().positive(),
    fmvWindowDays: z.number().int().positive(),
    gradeLabel: nullableString,
    points: z.array(RenaissOsFmvSeriesPointSchema),
    series: z.array(RenaissOsFmvMethodSeriesSchema)
  })
  .passthrough();

export const RenaissOsSearchResponseSchema = z
  .object({
    query: z.string(),
    results: z.array(RenaissOsCardSummarySchema)
  })
  .passthrough();

export const RenaissOsSetResponseSchema = z
  .object({
    game: RenaissOsGameSchema,
    setName: nullableString,
    setCode: nullableString,
    language: nullableString,
    setSegment: z.string(),
    href: z.string(),
    cardCount: z.number().int().nonnegative(),
    cards: z.array(RenaissOsCardSummarySchema)
  })
  .passthrough();

export const RenaissOsGradedLookupSchema = z
  .object({
    cert: z.string(),
    certNumber: z.string(),
    company: RenaissOsCompanySchema,
    found: z.boolean(),
    grade: nullableString,
    gradeLabel: nullableString,
    card: RenaissOsCardSummarySchema.nullable(),
    certImages: z
      .object({
        front: nullableString,
        back: nullableString,
        item: nullableString
      })
      .passthrough()
      .nullable(),
    collectible: z.record(z.unknown()).nullable().optional(),
    reason: z.string().nullable().optional()
  })
  .passthrough();

export type RenaissOsCardSummary = z.infer<typeof RenaissOsCardSummarySchema>;
export type RenaissOsCardDetail = z.infer<typeof RenaissOsCardDetailSchema>;
export type RenaissOsTradeRow = z.infer<typeof RenaissOsTradeRowSchema>;
export type RenaissOsFmvSeriesResponse = z.infer<typeof RenaissOsFmvSeriesResponseSchema>;
export type RenaissOsGradedLookup = z.infer<typeof RenaissOsGradedLookupSchema>;
