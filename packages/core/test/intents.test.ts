import { describe, expect, it } from "vitest";

import { matchIntentsToCards } from "../src/index.js";

const now = new Date("2026-06-27T12:00:00.000Z");

describe("deterministic intent matching", () => {
  it("returns reasons for a structured card match", () => {
    const matches = matchIntentsToCards({
      now,
      intents: [
        {
          id: "intent-1",
          intentType: "buy",
          queryText: "Looking for PSA 10 Japanese One Piece cards under $150.",
          tcg: "One Piece",
          language: "Japanese",
          maxPriceUsd: "150",
          status: "active"
        }
      ],
      cards: [
        {
          tokenId: "card-1",
          name: "Nami Renaiss Demo Intent Match",
          tcg: "One Piece",
          setName: "Demo Pirates",
          cardNumber: "OP-02",
          characterName: "Nami",
          grader: "PSA",
          grade: "10",
          language: "Japanese",
          fmvUsd: 120,
          liquidityScore: 45
        }
      ]
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.matchScore).toBeGreaterThanOrEqual(70);
    expect(matches[0]?.reasons.join(" ")).toContain("Language");
  });

  it("honors hard serial adjacency requirements", () => {
    const matches = matchIntentsToCards({
      now,
      intents: [
        {
          id: "intent-serial",
          intentType: "buy",
          queryText: "Looking for adjacent PSA cert Pikachu.",
          characterName: "Pikachu",
          grader: "PSA",
          requiresSerialAdjacency: true,
          status: "active"
        }
      ],
      cards: [
        {
          tokenId: "card-1",
          name: "Pikachu A",
          characterName: "Pikachu",
          grader: "PSA",
          serial: "PSA12345678"
        },
        {
          tokenId: "card-2",
          name: "Pikachu B",
          characterName: "Pikachu",
          grader: "PSA",
          serial: "PSA12345679"
        }
      ]
    });

    expect(matches).toHaveLength(2);
    expect(matches.every((match) => match.reasons.some((reason) => reason.includes("Serial")))).toBe(true);
  });
});
