import { RenaissOsConfidenceSchema, RenaissOsTradeKindSchema } from "@renaiss/core";
import { z } from "zod";

const RenaissOsGameSchema = z.enum(["pokemon", "one-piece", "sports"]);
const RenaissOsBucketSchema = z.enum(["public", "renaiss", "partner"]).nullable();
const RenaissOsCategorySchema = z
  .enum(["public", "blockchain", "renaiss", "partner", "internal"])
  .nullable();
const RenaissOsCompanySchema = z.enum(["PSA", "BGS", "CGC", "SGC", "RAW", "TAG"]).nullable();

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();
const nullableInt = z.number().int().nullable();
const dateString = z.string().datetime();
const RenaissOsCardTypeSchema = z.enum(["POKEMON", "ONE_PIECE", "SPORTS"]);
const RenaissOsFmvMethodSchema = z.enum(["median", "mean", "vwap"]);
const RenaissOsGradeSchema = z
  .enum([
    "1 Poor",
    "2 Good",
    "3 Very Good",
    "4 Very Good-Excellent",
    "5 Excellent",
    "6 Excellent-Mint",
    "7 Near Mint",
    "8 NM-MT",
    "8.5 NM-MT+",
    "9 Mint",
    "9.5 Mint",
    "10 Gem Mint",
    "8 NM/Mint",
    "8.5 NM/Mint+",
    "9.5 Mint +",
    "9.5 Gem Mint",
    "10 Pristine",
    "10 Black Label",
    "10 Perfect",
    "A",
    "B",
    "C",
    "D"
  ])
  .nullable();
const RenaissOsGradedReasonSchema = z.enum([
  "not_ingested",
  "company_unsupported",
  "compute_incomplete",
  "no_grade_price",
  "game_unsupported",
  "needs_photo"
]);

const RenaissOsDeltasSchema = z
  .object({
    d7: nullableNumber,
    d30: nullableNumber,
    d365: nullableNumber
  })
  .strict();

const RenaissOsSeriesPointSchema = z
  .object({
    t: dateString,
    usdCents: z.number().int().nonnegative(),
    source: nullableString.optional(),
    bucket: RenaissOsBucketSchema.optional(),
    category: RenaissOsCategorySchema.optional(),
    n: z.number().int().nonnegative().optional(),
    kind: RenaissOsTradeKindSchema.nullable().optional(),
    company: RenaissOsCompanySchema.optional(),
    grade: RenaissOsGradeSchema.optional(),
    gradeLabel: z.string().optional()
  })
  .strict();

const RenaissOsIndexMoverSchema = z
  .object({
    name: z.string(),
    setCode: nullableString,
    cardNumber: nullableString,
    grade: z.string(),
    href: z.string(),
    deltaPct: nullableNumber
  })
  .strict();

const RenaissOsIndexTileSchema = z
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
  .strict();

export const RenaissOsIndicesResponseSchema = z
  .object({
    indices: z.array(RenaissOsIndexTileSchema)
  })
  .strict();

const RenaissOsIndexConstituentSchema = z
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
  .strict();

export const RenaissOsIndexDetailSchema = RenaissOsIndexTileSchema.extend({
  windowDays: z.number().int().positive(),
  baseDate: nullableString,
  constituents: z.array(RenaissOsIndexConstituentSchema)
}).strict();

export const RenaissOsCardSummarySchema = z
  .object({
    game: RenaissOsGameSchema,
    type: RenaissOsCardTypeSchema,
    name: z.string(),
    setName: nullableString,
    setCode: nullableString,
    cardNumber: nullableString,
    variation: nullableString,
    language: nullableString,
    imageUrl: nullableString,
    imageUrlThumb: nullableString.optional(),
    company: RenaissOsCompanySchema,
    grade: RenaissOsGradeSchema,
    gradeLabel: z.string(),
    priceUsdCents: nullableInt,
    deltaPct: nullableNumber,
    confidence: RenaissOsConfidenceSchema,
    lastSaleAt: dateString.nullable(),
    spark: z.array(z.number().int().nonnegative()).optional(),
    href: z.string()
  })
  .strict();

export const RenaissOsFeaturedResponseSchema = z
  .object({
    cards: z.array(RenaissOsCardSummarySchema)
  })
  .strict();

const RenaissOsSourceBreakdownEntrySchema = z
  .object({
    source: z.string(),
    bucket: RenaissOsBucketSchema,
    category: RenaissOsCategorySchema,
    displayName: z.string(),
    count: z.number().int().nonnegative(),
    medianUsdCents: nullableInt,
    overviewUrl: nullableString
  })
  .strict();

const RenaissOsFmvMethodValueSchema = z
  .object({
    method: RenaissOsFmvMethodSchema,
    scorerVersion: z.string(),
    label: z.string(),
    priceUsdCents: nullableInt,
    confidence: RenaissOsConfidenceSchema,
    sourceCount: nullableInt,
    observationCount: nullableInt
  })
  .strict();

const RenaissOsGradeRowSchema = z
  .object({
    company: RenaissOsCompanySchema,
    grade: RenaissOsGradeSchema,
    gradeLabel: z.string(),
    priceUsdCents: nullableInt,
    deltaPct: nullableNumber,
    confidence: RenaissOsConfidenceSchema,
    lastSaleAt: dateString.nullable(),
    href: z.string(),
    current: z.boolean()
  })
  .strict();

const RenaissOsLanguageVariantSchema = z
  .object({
    language: z.string(),
    priceUsdCents: nullableInt,
    confidence: RenaissOsConfidenceSchema,
    href: z.string(),
    current: z.boolean()
  })
  .strict();

const RenaissOsCardVariantSchema = z
  .object({
    variation: nullableString,
    priceUsdCents: nullableInt,
    confidence: RenaissOsConfidenceSchema,
    href: z.string(),
    current: z.boolean()
  })
  .strict();

export const RenaissOsCardDetailSchema = z
  .object({
    id: z.string(),
    game: RenaissOsGameSchema,
    type: RenaissOsCardTypeSchema,
    name: z.string(),
    setName: nullableString,
    setCode: nullableString,
    cardNumber: nullableString,
    variation: nullableString,
    language: nullableString,
    imageUrl: nullableString,
    imageUrlLg: nullableString,
    company: RenaissOsCompanySchema,
    grade: RenaissOsGradeSchema,
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
    trackedSources: z.array(RenaissOsSourceBreakdownEntrySchema).default([]),
    methods: z.array(RenaissOsFmvMethodValueSchema),
    otherGrades: z.array(RenaissOsGradeRowSchema),
    otherLanguages: z.array(RenaissOsLanguageVariantSchema).default([]),
    otherVariants: z.array(RenaissOsCardVariantSchema).default([]),
    similar: z.array(RenaissOsCardSummarySchema),
    href: z.string(),
    pageUrl: z.string()
  })
  .strict();

export const RenaissOsTradeRowSchema = z
  .object({
    source: z.string(),
    bucket: RenaissOsBucketSchema,
    category: RenaissOsCategorySchema,
    displayName: z.string(),
    observedAt: dateString,
    kind: RenaissOsTradeKindSchema,
    priceUsdCents: nullableInt,
    priceMinor: nullableInt,
    currency: z.string(),
    detail: nullableString,
    sourceUrl: nullableString,
    company: RenaissOsCompanySchema,
    grade: RenaissOsGradeSchema,
    gradeLabel: nullableString
  })
  .strict();

export const RenaissOsTradesResponseSchema = z
  .object({
    trades: z.array(RenaissOsTradeRowSchema),
    total: z.number().int().nonnegative()
  })
  .strict();

const RenaissOsRecentTradeSchema = RenaissOsTradeRowSchema.extend({
  id: z.string(),
  card: z
    .object({
      game: RenaissOsGameSchema,
      name: z.string(),
      grade: RenaissOsGradeSchema,
      gradeLabel: z.string(),
      setCode: nullableString,
      cardNumber: nullableString,
      href: z.string(),
      imageUrl: nullableString
    })
    .strict()
}).strict();

export const RenaissOsRecentTradesResponseSchema = z
  .object({
    trades: z.array(RenaissOsRecentTradeSchema)
  })
  .strict();

export const RenaissOsSeriesResponseSchema = z
  .object({
    windowDays: z.number().int().positive(),
    points: z.array(RenaissOsSeriesPointSchema)
  })
  .strict();

const RenaissOsFmvSourcePointSchema = z
  .object({
    source: z.string(),
    bucket: RenaissOsBucketSchema,
    category: RenaissOsCategorySchema,
    displayName: z.string(),
    usdCents: z.number().int().nonnegative(),
    n: z.number().int().nonnegative()
  })
  .strict();

const RenaissOsFmvSeriesPointSchema = z
  .object({
    t: dateString,
    usdCents: z.number().int().nonnegative(),
    n: z.number().int().nonnegative(),
    bySource: z.array(RenaissOsFmvSourcePointSchema)
  })
  .strict();

const RenaissOsFmvMethodSeriesSchema = z
  .object({
    method: RenaissOsFmvMethodSchema,
    scorerVersion: z.string(),
    label: z.string(),
    points: z.array(
      z
        .object({
          t: dateString,
          usdCents: z.number().int().nonnegative()
        })
        .strict()
    )
  })
  .strict();

export const RenaissOsFmvSeriesResponseSchema = z
  .object({
    windowDays: z.number().int().positive(),
    fmvWindowDays: z.number().int().positive(),
    gradeLabel: nullableString,
    points: z.array(RenaissOsFmvSeriesPointSchema),
    series: z.array(RenaissOsFmvMethodSeriesSchema)
  })
  .strict();

export const RenaissOsSearchResponseSchema = z
  .object({
    query: z.string(),
    results: z.array(RenaissOsCardSummarySchema)
  })
  .strict();

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
  .strict();

const RenaissOsCollectibleSchema = z
  .object({
    id: z.string(),
    renaissItemId: nullableString,
    itemId: nullableString,
    cardIdentifier: z.string(),
    gradingCompany: RenaissOsCompanySchema,
    grade: nullableString,
    reviewStatus: z.string(),
    lookupOk: z.boolean(),
    inferredType: nullableString,
    source: z.string(),
    frontImageUrl: nullableString,
    backImageUrl: nullableString,
    frontWithoutStandImageUrl: nullableString,
    animationUrl: nullableString,
    itemImageUrl: nullableString,
    imageSource: nullableString,
    imageSourceObservationId: nullableString,
    imageFetchAttemptedAt: nullableString,
    imageFetchAttempts: z.number(),
    subject: nullableString,
    year: nullableNumber,
    brand: nullableString,
    cardNumber: nullableString,
    category: nullableString,
    variety: nullableString,
    gradeDescription: nullableString,
    specId: nullableNumber,
    specNumber: nullableString,
    labelType: nullableString,
    totalPopulation: nullableNumber,
    populationHigher: nullableNumber,
    isPsaDna: z.boolean().nullable(),
    isDualCert: z.boolean().nullable(),
    reverseBarCode: z.boolean().nullable(),
    rawLookup: z.unknown().nullable().optional(),
    collectibleCreatedAt: nullableString,
    collectibleUpdatedAt: nullableString,
    importedAt: z.string(),
    createdAt: z.string(),
    updatedAt: z.string()
  })
  .strict();

export const RenaissOsGradedLookupSchema = z
  .object({
    cert: z.string(),
    certNumber: z.string(),
    company: RenaissOsCompanySchema,
    found: z.boolean(),
    grade: RenaissOsGradeSchema,
    gradeLabel: nullableString,
    card: RenaissOsCardSummarySchema.nullable(),
    certImages: z
      .object({
        front: nullableString,
        back: nullableString,
        item: nullableString
      })
      .strict()
      .nullable(),
    collectible: RenaissOsCollectibleSchema.nullable().optional(),
    reason: RenaissOsGradedReasonSchema.nullable().optional()
  })
  .strict();

export type RenaissOsCardSummary = z.infer<typeof RenaissOsCardSummarySchema>;
export type RenaissOsCardDetail = z.infer<typeof RenaissOsCardDetailSchema>;
export type RenaissOsIndexDetail = z.infer<typeof RenaissOsIndexDetailSchema>;
export type RenaissOsTradeRow = z.infer<typeof RenaissOsTradeRowSchema>;
export type RenaissOsFmvSeriesResponse = z.infer<typeof RenaissOsFmvSeriesResponseSchema>;
export type RenaissOsGradedLookup = z.infer<typeof RenaissOsGradedLookupSchema>;
