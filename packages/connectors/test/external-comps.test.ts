import { describe, expect, it } from "vitest";

import {
  buildExternalCompQueue,
  convertToUsd,
  createExchangeRateConnector,
  createPriceChartingConnector,
  createSerialRateLimiter,
  createSnkrdunkConnector,
  generateExternalCompSearchTerms
} from "../src/index.js";
import type { ExternalCompCardInput } from "../src/index.js";

const now = new Date("2026-07-06T12:00:00.000Z");
const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
};

const card: ExternalCompCardInput = {
  tokenId: "fixture-card-001",
  name: "Pikachu Fixture PSA 10",
  setName: "Demo Sparks",
  cardNumber: "025",
  characterName: "Pikachu",
  tcg: "Pokemon",
  grader: "PSA",
  grade: "10",
  language: "Japanese",
  year: 2024,
  fmvUsd: 100,
  askPriceUsd: 82
};

describe("external comp helpers", () => {
  it("generates structured search terms before source fetches", () => {
    expect(generateExternalCompSearchTerms(card)[0]).toBe(
      "2024 Pokemon Demo Sparks #025 Pikachu PSA 10"
    );
  });

  it("converts source currencies through USD-based exchange rates", () => {
    expect(
      convertToUsd(14_700, "JPY", {
        baseCurrency: "USD",
        ratesPerUsd: { USD: 1, JPY: 147 },
        fetchedAt: now.toISOString(),
        source: "exchange_rates",
        sourceUrl: "fixture://rates",
        live: false
      })
    ).toBe("100.00");
  });

  it("builds an incremental queue for missing and stale source comps", () => {
    const queue = buildExternalCompQueue({
      cards: [card],
      existingComps: [
        {
          tokenId: card.tokenId,
          platform: "snkrdunk",
          fetchedAt: "2026-06-20T00:00:00.000Z"
        }
      ],
      sources: ["snkrdunk", "pricecharting"],
      now,
      staleAfterDays: 7,
      limit: 10
    });

    expect(queue).toHaveLength(1);
    expect(queue[0]?.duePlatforms.sort()).toEqual(["pricecharting", "snkrdunk"]);
    expect(queue[0]?.reason).toBe("missing");
  });
});

describe("external comp fixture connectors", () => {
  it("normalizes SNKRDUNK fixture comps with JPY price conversion", async () => {
    const exchange = await createExchangeRateConnector().fetch(
      {},
      {
        runId: "test-run",
        now,
        logger,
        rateLimiter: createSerialRateLimiter(0)
      }
    );
    const result = await createSnkrdunkConnector({ rateLimitMs: 0 }).fetch(
      { cards: [card], exchangeRates: exchange.data },
      {
        runId: "test-run",
        now,
        logger,
        rateLimiter: createSerialRateLimiter(0)
      }
    );

    expect(result.data.snapshots).toHaveLength(1);
    expect(result.data.snapshots[0]?.platform).toBe("snkrdunk");
    expect(result.data.snapshots[0]?.currentPriceUsd).toBe("102.00");
    expect(result.data.snapshots[0]?.rejected).toBe(false);
    expect(result.data.snapshots[0]?.metadata["mockData"]).toBe(true);
  });

  it("records PriceCharting fixture rejection reasons for mismatches", async () => {
    const exchange = await createExchangeRateConnector().fetch(
      {},
      {
        runId: "test-run",
        now,
        logger,
        rateLimiter: createSerialRateLimiter(0)
      }
    );
    const result = await createPriceChartingConnector({ rateLimitMs: 0 }).fetch(
      {
        cards: [
          {
            ...card,
            tokenId: "demo-card-004",
            cardNumber: "OP-01",
            language: "Japanese",
            grade: "10",
            fmvUsd: 90
          }
        ],
        exchangeRates: exchange.data
      },
      {
        runId: "test-run",
        now,
        logger,
        rateLimiter: createSerialRateLimiter(0)
      }
    );

    expect(result.data.snapshots[0]?.rejected).toBe(true);
    expect(result.data.snapshots[0]?.rejectionReason).toContain("card number mismatch");
    expect(result.data.snapshots[0]?.matchReasons).toContain("language mismatch");
  });
});
