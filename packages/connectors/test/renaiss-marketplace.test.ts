import { describe, expect, it } from "vitest";

import {
  createRenaissMarketplaceConnector,
  createSerialRateLimiter,
  normalizeRenaissMarketplaceItem
} from "../src/index.js";

const observedAt = "2026-06-27T00:00:00.000Z";

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
};

const listedFixture = {
  tokenId: "listed-001",
  itemId: "item-listed-001",
  name: "Pikachu Fixture PSA 10",
  setName: "Fixture Sparks",
  cardNumber: "025",
  pokemonName: "Pikachu",
  ownerAddress: "0x1111111111111111111111111111111111111111",
  owner: { username: "fixture-owner" },
  frontImageUrl: "https://example.com/pikachu.png",
  year: 2024,
  askPriceInUSDT: "140000000000000000000",
  offerPriceInUSDT: "132000000000000000000",
  fmvPriceInUSD: "15000",
  buybackBaseValueInUSD: "9000",
  topOffer: "133.50",
  lastSale: "148",
  attributes: [
    { trait_type: "Serial", value: "PSA12345678" },
    { trait_type: "Grader", value: "PSA" },
    { trait_type: "Grade", value: "10" },
    { trait_type: "Language", value: "Japanese" }
  ]
};

const unlistedFixture = {
  tokenId: "unlisted-001",
  name: "Charizard Fixture PSA 9",
  setName: "Fixture Flames",
  cardNumber: "006",
  characterName: "Charizard",
  status: "unlisted",
  askPriceInUSDT: "NO-ASK-PRICE",
  fmvPriceInUSD: "30000",
  attributes: {
    Serial: "PSA22345678",
    Grader: "PSA",
    Grade: "9",
    Language: "English"
  }
};

describe("Renaiss marketplace normalization", () => {
  it("normalizes listed cards and price units", () => {
    const normalized = normalizeRenaissMarketplaceItem(listedFixture, {
      strategy: "v0",
      observedAt,
      sourceUrl: "https://example.com/marketplace"
    });

    expect(normalized.card?.tokenId).toBe("listed-001");
    expect(normalized.card?.status).toBe("listed");
    expect(normalized.card?.grader).toBe("PSA");
    expect(normalized.card?.grade).toBe("10");
    expect(normalized.card?.language).toBe("Japanese");
    expect(normalized.card?.serialNum).toBe(12345678n);
    expect(normalized.price?.askPriceUsd).toBe("140");
    expect(normalized.price?.offerPriceUsd).toBe("132");
    expect(normalized.price?.fmvUsd).toBe("150");
    expect(normalized.price?.buybackBaseValueUsd).toBe("90");
    expect(normalized.price?.topOfferUsd).toBe("133.50");
    expect(normalized.dataQualityEvents).toEqual([]);
  });

  it("normalizes unlisted cards without inventing ask prices", () => {
    const normalized = normalizeRenaissMarketplaceItem(unlistedFixture, {
      strategy: "trpc",
      observedAt,
      sourceUrl: "https://example.com/trpc"
    });

    expect(normalized.card?.status).toBe("unlisted");
    expect(normalized.price?.isListed).toBe(false);
    expect(normalized.price?.askPriceUsd).toBeNull();
    expect(normalized.price?.fmvUsd).toBe("300");
    expect(normalized.card?.serialNum).toBe(22345678n);
  });
});

describe("Renaiss marketplace connector", () => {
  it("extracts tRPC fixture pages and converts prices", async () => {
    const requests: string[] = [];
    const connector = createRenaissMarketplaceConnector({
      strategy: "trpc",
      trpcUrl: "https://www.renaiss.xyz/api/trpc/collectible.list",
      pageSize: 50,
      maxPages: 1,
      listedOnly: true,
      rateLimitMs: 0,
      retryAttempts: 1,
      retryBaseDelayMs: 0,
      fetch: async (input) => {
        requests.push(String(input));
        return new Response(
          JSON.stringify({
            result: {
              data: {
                json: {
                  items: [listedFixture, unlistedFixture],
                  hasMore: false
                }
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    const result = await connector.fetch(
      {},
      {
        runId: "test-run",
        now: new Date(observedAt),
        logger,
        rateLimiter: createSerialRateLimiter(0)
      }
    );

    expect(requests).toHaveLength(1);
    expect(result.source).toBe("renaiss_trpc_collectible_list");
    expect(result.data.cards).toHaveLength(2);
    expect(result.data.prices.map((price) => price.askPriceUsd)).toEqual(["140", null]);
    expect(result.data.pages[0]?.rawItems).toHaveLength(2);
  });
});
