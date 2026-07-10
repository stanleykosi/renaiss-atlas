import { describe, expect, it } from "vitest";

import {
  RenaissOsCardSummarySchema,
  RenaissOsGradedLookupSchema,
  RenaissOsTradeRowSchema
} from "./schemas";

const tradeRow = {
  source: "site_s",
  bucket: "public",
  category: "public",
  displayName: "Site S",
  observedAt: "2026-07-10T09:00:00.000Z",
  kind: "transaction",
  priceUsdCents: 10_247,
  priceMinor: 16_500,
  currency: "JPY",
  detail: null,
  sourceUrl: null,
  company: "PSA",
  grade: "10 Gem Mint",
  gradeLabel: "PSA 10"
} as const;

const collectible = {
  id: "collectible-1",
  renaissItemId: null,
  itemId: null,
  cardIdentifier: "pokemon-card-1",
  gradingCompany: "PSA",
  grade: "10",
  reviewStatus: "reviewed",
  lookupOk: true,
  inferredType: "pokemon",
  source: "psa",
  frontImageUrl: null,
  backImageUrl: null,
  frontWithoutStandImageUrl: null,
  animationUrl: null,
  itemImageUrl: null,
  imageSource: null,
  imageSourceObservationId: null,
  imageFetchAttemptedAt: null,
  imageFetchAttempts: 1,
  subject: "Pikachu",
  year: 2024,
  brand: "Pokemon",
  cardNumber: "001",
  category: "TCG",
  variety: null,
  gradeDescription: "Gem Mint",
  specId: null,
  specNumber: null,
  labelType: null,
  totalPopulation: 12,
  populationHigher: 0,
  isPsaDna: false,
  isDualCert: false,
  reverseBarCode: false,
  rawLookup: { providerStatus: "complete" },
  collectibleCreatedAt: "2026-07-01T00:00:00.000Z",
  collectibleUpdatedAt: "2026-07-10T00:00:00.000Z",
  importedAt: "2026-07-01T00:00:00.000Z",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z"
} as const;

describe("official Renaiss OS response schemas", () => {
  it("enforces required trade source classifications and documented grades", () => {
    expect(RenaissOsTradeRowSchema.parse(tradeRow)).toEqual(tradeRow);
    expect(RenaissOsTradeRowSchema.safeParse({ ...tradeRow, bucket: undefined }).success).toBe(
      false
    );
    expect(RenaissOsTradeRowSchema.safeParse({ ...tradeRow, grade: "11 Impossible" }).success).toBe(
      false
    );
  });

  it("rejects undocumented response properties", () => {
    expect(RenaissOsTradeRowSchema.safeParse({ ...tradeRow, hiddenConfidence: 99 }).success).toBe(
      false
    );
  });

  it("models the graded collectible contract while retaining opaque raw lookup data", () => {
    const lookup = RenaissOsGradedLookupSchema.parse({
      cert: "12345678",
      certNumber: "12345678",
      company: "PSA",
      found: false,
      grade: "10 Gem Mint",
      gradeLabel: "PSA 10",
      card: null,
      certImages: null,
      collectible,
      reason: "no_grade_price"
    });

    expect(lookup.collectible?.lookupOk).toBe(true);
    expect(lookup.collectible?.rawLookup).toEqual({ providerStatus: "complete" });
    expect(
      RenaissOsGradedLookupSchema.safeParse({
        cert: "12345678",
        certNumber: "12345678",
        company: "PSA",
        found: false,
        grade: null,
        gradeLabel: null,
        card: null,
        certImages: null,
        collectible: null,
        reason: "legacy_fallback"
      }).success
    ).toBe(false);
  });

  it("accepts the documented optional card thumbnail and spark fields", () => {
    const parsed = RenaissOsCardSummarySchema.parse({
      game: "pokemon",
      type: "POKEMON",
      name: "Rayquaza VMAX",
      setName: "Evolving Skies",
      setCode: "EVS",
      cardNumber: "111",
      variation: "Triple Rare",
      language: "English",
      imageUrl: null,
      imageUrlThumb: null,
      company: "PSA",
      grade: "10 Gem Mint",
      gradeLabel: "PSA 10",
      priceUsdCents: 23_600,
      deltaPct: 32.48,
      confidence: "low",
      lastSaleAt: "2026-07-06T00:00:00.000Z",
      spark: [8200, 8930],
      href: "/card/pokemon/evolving-skies/rayquaza-vmax"
    });

    expect(parsed.grade).toBe("10 Gem Mint");
    expect(parsed.spark).toEqual([8200, 8930]);
  });
});
