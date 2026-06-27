import { describe, expect, it } from "vitest";

import { detectBundles, type BundleDetectionCardInput } from "../src/index.js";

const ownerAddress = "0x1111111111111111111111111111111111111111";

function card(input: Partial<BundleDetectionCardInput> & { tokenId: string }): BundleDetectionCardInput {
  return {
    tokenId: input.tokenId,
    name: input.name ?? `Card ${input.tokenId}`,
    setName: input.setName ?? "Demo Set",
    cardNumber: input.cardNumber ?? "001",
    characterName: input.characterName ?? "Pikachu",
    tcg: input.tcg ?? "Pokemon",
    ownerAddress: input.ownerAddress ?? ownerAddress,
    ownerUsername: input.ownerUsername ?? "demo",
    grader: input.grader ?? "PSA",
    grade: input.grade ?? "10",
    language: input.language ?? "Japanese",
    serial: input.serial ?? `PSA${input.tokenId}`,
    serialNum: input.serialNum ?? null,
    status: input.status ?? "listed",
    askPriceUsd: input.askPriceUsd ?? 100,
    fmvUsd: input.fmvUsd ?? 110,
    mockData: input.mockData ?? true
  };
}

describe("bundle detection", () => {
  it("detects sequential cert pairs", () => {
    const bundles = detectBundles({
      cards: [
        card({ tokenId: "first", serialNum: 12345678n, cardNumber: "025" }),
        card({ tokenId: "second", serialNum: 12345679n, cardNumber: "026" }),
        card({ tokenId: "far", serialNum: 12345690n, cardNumber: "090" })
      ]
    });
    const sequential = bundles.find((bundle) => bundle.bundleType === "sequential_cert_pair");

    expect(sequential).toBeDefined();
    expect(sequential?.items.map((item) => item.tokenId)).toEqual(["first", "second"]);
    expect(sequential?.reasons).toContain("Adjacent certification numbers.");
    expect(sequential?.score).toBeGreaterThanOrEqual(80);
  });

  it("detects same-character bundles", () => {
    const bundles = detectBundles({
      cards: [
        card({ tokenId: "pikachu-1", cardNumber: "025", serialNum: 100n }),
        card({ tokenId: "pikachu-2", cardNumber: "026", serialNum: 200n }),
        card({ tokenId: "charizard", characterName: "Charizard", cardNumber: "006", serialNum: 300n })
      ]
    });
    const sameCharacter = bundles.find((bundle) => bundle.bundleType === "same_character");

    expect(sameCharacter).toBeDefined();
    expect(sameCharacter?.items.map((item) => item.tokenId).sort()).toEqual([
      "pikachu-1",
      "pikachu-2"
    ]);
    expect(sameCharacter?.name).toContain("Pikachu");
  });
});
