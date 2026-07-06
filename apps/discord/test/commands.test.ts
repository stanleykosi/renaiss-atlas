import { describe, expect, it } from "vitest";

import { atlasApplicationCommand, atlasCommandNames } from "../src/commands.js";
import { handleAtlasInteraction } from "../src/responses.js";
import { verifyDiscordInteractionRequest } from "../src/verification.js";

describe("discord commands", () => {
  it("registers /atlas with the requested subcommands", () => {
    expect(atlasApplicationCommand.name).toBe("atlas");
    expect(atlasApplicationCommand.options.map((option) => option.name)).toEqual(atlasCommandNames);
    expect(atlasCommandNames).toEqual(["market", "card", "wallet", "intent", "bundle", "pack"]);
  });

  it("rejects verification when signed headers are missing", async () => {
    await expect(
      verifyDiscordInteractionRequest({
        rawBody: "{}",
        signature: null,
        timestamp: null,
        publicKey: "abc"
      })
    ).resolves.toBe(false);
  });

  it("returns a concise market response with freshness and link", async () => {
    const response = await handleAtlasInteraction(
      {
        id: "interaction-1",
        type: 2,
        data: {
          name: "atlas",
          options: [{ type: 1, name: "market" }]
        }
      },
      {
        async getMarketOverview() {
          return {
            generatedAt: "2026-07-06T00:00:00.000Z",
            cards: [],
            health: {
              totalCards: 7,
              listedCards: 4,
              underFmvCount: 2,
              externalMismatchCount: 1,
              averageLiquidityScore: 61,
              freshness: "fresh",
              sourceLabel: "Seed fixtures",
              mockData: true
            },
            syncStatus: {
              freshness: [{ source: "renaiss_marketplace_v0", status: "fresh" }]
            }
          };
        },
        async getCardDetail() {
          return null;
        },
        async getWalletCopilot() {
          return {
            status: "invalid",
            address: "not-an-address",
            message: "Invalid wallet."
          };
        },
        async getIntentBoard() {
          return {
            generatedAt: "2026-07-06T00:00:00.000Z",
            health: {
              activeIntents: 0,
              matchedCards: 0,
              highConfidenceMatches: 0,
              mockData: true
            },
            intents: []
          };
        },
        async getBundleOverview() {
          return {
            generatedAt: "2026-07-06T00:00:00.000Z",
            health: {
              totalBundles: 0,
              highConfidenceBundles: 0,
              detectedCards: 0,
              mockData: true
            },
            bundles: []
          };
        },
        async getPackMomentumOverview() {
          return {
            generatedAt: "2026-07-06T00:00:00.000Z",
            disclaimer: "Observed activity only.",
            health: {
              totalPacks: 0,
              totalPulls: 0,
              pulls24h: 0,
              latestPulledAt: null,
              stalePacks: 0,
              mockData: true
            },
            packs: []
          };
        }
      },
      {
        appUrl: "https://atlas.example"
      }
    );

    expect(response.data?.content).toContain("Freshness: fresh");
    expect(response.data?.content).toContain("https://atlas.example/market");
    expect(response.data?.content.length).toBeLessThan(500);
  });
});
