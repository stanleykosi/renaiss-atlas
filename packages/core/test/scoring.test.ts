import { describe, expect, it } from "vitest";

import { scoreRenaissOsCard } from "../src/index.js";

const now = new Date("2026-06-27T12:00:00.000Z");

describe("official Renaiss OS scoring", () => {
  it("keeps scores bounded and explainable", () => {
    const result = scoreRenaissOsCard({
      cardId: "official-card",
      confidence: "high",
      sourceCount: 4,
      observationCount: 12,
      totalObservationCount: 24,
      lastSaleAt: now.toISOString(),
      updatedAt: now.toISOString(),
      priceUsdCents: 12500,
      trades: [
        {
          observedAt: now.toISOString(),
          kind: "transaction",
          priceUsdCents: 12400,
          source: "renaissos_index"
        }
      ],
      fmvSeries: [
        {
          t: now.toISOString(),
          usdCents: 12500,
          n: 4
        }
      ],
      sourceBreakdown: [
        {
          source: "renaissos_index",
          category: "public",
          count: 12,
          medianUsdCents: 12500
        }
      ],
      now
    });

    expect(Object.keys(result.scores).sort()).toEqual([
      "activity_velocity",
      "liquidity",
      "price_confidence",
      "source_confidence"
    ]);

    for (const score of Object.values(result.scores)) {
      expect(score?.value).toBeGreaterThanOrEqual(0);
      expect(score?.value).toBeLessThanOrEqual(100);
      expect(score?.reasons.length).toBeGreaterThan(0);
      expect(score?.inputsHash.length).toBeGreaterThan(0);
    }
  });

  it("flags sparse official evidence without invalid values", () => {
    const result = scoreRenaissOsCard({
      cardId: "sparse-official-card",
      confidence: "low",
      sourceCount: 1,
      observationCount: 0,
      totalObservationCount: 0,
      updatedAt: "2026-01-01T00:00:00.000Z",
      now
    });

    expect(result.scores.price_confidence?.riskFlags).toContain("official_confidence_low");
    expect(result.scores.price_confidence?.riskFlags).toContain("official_observations_missing");
    expect(result.scores.source_confidence?.riskFlags).toContain("single_source_evidence");

    for (const score of Object.values(result.scores)) {
      expect(Number.isFinite(score?.value)).toBe(true);
      expect(score?.value).toBeGreaterThanOrEqual(0);
      expect(score?.value).toBeLessThanOrEqual(100);
    }
  });

  it("lets heavy trade and FMV depth lift activity and liquidity even when Renaiss confidence is low", () => {
    const trades = Array.from({ length: 50 }, (_, index) => ({
      observedAt: new Date(now.getTime() - index * 60 * 60 * 1000).toISOString(),
      kind: index % 2 === 0 ? "transaction" as const : "listing" as const,
      priceUsdCents: 200000 + index,
      source: "renaissos_index"
    }));
    const fmvSeries = Array.from({ length: 259 }, (_, index) => ({
      t: new Date(now.getTime() - index * 24 * 60 * 60 * 1000).toISOString(),
      usdCents: 200000,
      n: 1
    }));

    const result = scoreRenaissOsCard({
      cardId: "active-low-confidence-card",
      confidence: "low",
      sourceCount: 1,
      observationCount: 0,
      totalObservationCount: 259,
      lastSaleAt: now.toISOString(),
      updatedAt: now.toISOString(),
      trades,
      fmvSeries,
      sourceBreakdown: [
        {
          source: "renaissos_index",
          category: "public",
          count: 259,
          medianUsdCents: 200000
        }
      ],
      now
    });

    expect(result.scores.activity_velocity?.value).toBe(100);
    expect(result.scores.activity_velocity?.confidence).toBe("high");
    expect(result.scores.liquidity?.value).toBeGreaterThanOrEqual(75);
    expect(result.scores.liquidity?.confidence).toBe("high");
    expect(result.scores.price_confidence?.value).toBeGreaterThanOrEqual(50);
    expect(result.scores.price_confidence?.confidence).toBe("medium");
  });
});
