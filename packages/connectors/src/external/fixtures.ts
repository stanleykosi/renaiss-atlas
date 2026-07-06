import type { ExternalCompCandidate, ExternalCompCardInput, ExternalCompSourcePlatform } from "./types.js";

function fallbackTitle(card: ExternalCompCardInput, platform: ExternalCompSourcePlatform): string {
  const source = platform === "snkrdunk" ? "SNKRDUNK fixture" : "PriceCharting fixture";
  return `${card.characterName || card.name} ${card.setName} #${card.cardNumber} ${card.grader ?? "PSA"} ${card.grade ?? ""} ${source}`;
}

function fixturePrice(card: ExternalCompCardInput, platform: ExternalCompSourcePlatform): number {
  const fmv = card.fmvUsd ?? card.askPriceUsd ?? 100;
  return platform === "snkrdunk" ? Math.round(fmv * 147 * 1.02) : Number((fmv * 0.98).toFixed(2));
}

export function fixtureExternalCompCandidates(
  card: ExternalCompCardInput,
  platform: ExternalCompSourcePlatform
): ExternalCompCandidate[] {
  if (card.tokenId === "demo-card-004") {
    return [
      {
        externalId: `${platform}:fixture:luffy-mismatch`,
        platform,
        productTitle: "Wrong Luffy Parallel English PSA 8",
        productUrl: `https://renaiss-atlas.local/fixtures/${platform}/luffy-mismatch`,
        currency: platform === "snkrdunk" ? "JPY" : "USD",
        currentPrice: platform === "snkrdunk" ? 132_300 : 900,
        grade: "PSA 8",
        language: "English",
        cardNumber: "OP-99",
        raw: { fixture: true, case: "external comp mismatch" },
        fixture: true
      }
    ];
  }

  return [
    {
      externalId: `${platform}:fixture:${card.tokenId}`,
      platform,
      productTitle: fallbackTitle(card, platform),
      productUrl: `https://renaiss-atlas.local/fixtures/${platform}/${encodeURIComponent(card.tokenId)}`,
      currency: platform === "snkrdunk" ? "JPY" : "USD",
      currentPrice: fixturePrice(card, platform),
      averagePrice: platform === "snkrdunk" ? null : fixturePrice(card, platform),
      lastSale: platform === "snkrdunk" ? fixturePrice(card, platform) : null,
      volume30d: platform === "snkrdunk" ? 4 : 7,
      grade: `${card.grader ?? "PSA"} ${card.grade ?? ""}`.trim(),
      language: card.language ?? null,
      cardNumber: card.cardNumber,
      raw: { fixture: true, tokenId: card.tokenId },
      fixture: true
    }
  ];
}
