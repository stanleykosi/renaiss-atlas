import { describe, expect, it } from "vitest";

import {
  scoreCard,
  scoreCollectorPremium,
  scoreDeal,
  scoreExternalCompConfidence,
  type DeterministicCardScoringInput
} from "../src/index.js";

const now = new Date("2026-06-27T12:00:00.000Z");

const baseInput: DeterministicCardScoringInput = {
  tokenId: "score-test-card",
  status: "listed",
  askPriceUsd: 80,
  fmvUsd: 100,
  topOfferUsd: 75,
  lastSaleUsd: 95,
  observedAt: now.toISOString(),
  lastSaleAt: now.toISOString(),
  externalComps: [{ priceUsd: 102, matchConfidence: 92, rejected: false, fetchedAt: now }],
  intentMatches: [{ matchScore: 80, createdAt: now }],
  grade: "10",
  now
};

describe("deterministic scoring", () => {
  it("keeps every score bounded and explainable", () => {
    const result = scoreCard(baseInput);
    const scores = Object.values(result.scores);

    expect(scores).toHaveLength(11);

    for (const score of scores) {
      expect(score.value).toBeGreaterThanOrEqual(0);
      expect(score.value).toBeLessThanOrEqual(100);
      expect(score.reasons.length).toBeGreaterThan(0);
      expect(score.inputsHash.length).toBeGreaterThan(0);
    }
  });

  it("handles sparse cards without producing invalid values", () => {
    const result = scoreCard({
      tokenId: "sparse-card",
      status: "unknown",
      now
    });

    for (const score of Object.values(result.scores)) {
      expect(Number.isFinite(score.value)).toBe(true);
      expect(score.value).toBeGreaterThanOrEqual(0);
      expect(score.value).toBeLessThanOrEqual(100);
    }

    expect(result.scores.price_consensus.riskFlags).toContain("fmv_missing");
  });

  it("penalizes deal and comp confidence when external comps are rejected", () => {
    const accepted = baseInput;
    const rejected: DeterministicCardScoringInput = {
      ...baseInput,
      externalComps: [{ priceUsd: 450, matchConfidence: 18, rejected: true, fetchedAt: now }]
    };

    expect(scoreDeal(rejected).value).toBeLessThan(scoreDeal(accepted).value);
    expect(scoreExternalCompConfidence(rejected).value).toBeLessThan(
      scoreExternalCompConfidence(accepted).value
    );
    expect(scoreExternalCompConfidence(rejected).riskFlags).toContain("external_comp_mismatch");
  });

  it("excludes stale and low-confidence comps from deal support", () => {
    const supported = scoreDeal(baseInput);
    const weak: DeterministicCardScoringInput = {
      ...baseInput,
      externalComps: [
        {
          priceUsd: 105,
          matchConfidence: 30,
          rejected: false,
          fetchedAt: now
        },
        {
          priceUsd: 103,
          matchConfidence: 90,
          rejected: false,
          fetchedAt: "2026-06-01T00:00:00.000Z"
        }
      ]
    };

    const confidence = scoreExternalCompConfidence(weak);
    expect(scoreDeal(weak).value).toBeLessThan(supported.value);
    expect(confidence.riskFlags).toContain("low_match_confidence");
    expect(confidence.riskFlags).toContain("external_comp_stale");
  });

  it("raises collector premium for adjacency and pack-origin signals", () => {
    const plain = scoreCollectorPremium({ ...baseInput, grade: "9" });
    const premium = scoreCollectorPremium({
      ...baseInput,
      adjacentCertExists: true,
      sameCharacterBundleExists: true,
      packOriginStory: true
    });

    expect(premium.value).toBeGreaterThan(plain.value);
    expect(premium.reasons.join(" ")).toContain("Adjacent");
  });
});
