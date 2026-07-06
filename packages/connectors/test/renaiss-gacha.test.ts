import { describe, expect, it } from "vitest";

import {
  createRenaissGachaConnector,
  createSerialRateLimiter,
  extractPsaIdFromImageUrl,
  parseRenaissFmvCents,
  parseRenaissGachaRscActivities
} from "../src/index.js";

const observedAt = "2026-07-06T12:00:00.000Z";

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
};

function rscFixture(activityJson: string) {
  return `1:"$Sreact.fragment"
34:["$","$L35",null,{"packTotal":0,"openedPackActivities":${activityJson},"fetchContent":"$h4e"}]
35:I[123,[],"default"]`;
}

describe("Renaiss gacha RSC parsing", () => {
  it("parses openedPackActivities, FMV cents, timestamps, and PSA IDs", () => {
    const parsed = parseRenaissGachaRscActivities({
      rawText: rscFixture(
        JSON.stringify([
          {
            id: "pull-001",
            tier: "rare",
            fmv: "$n11550",
            pulledAtTimestamp: 1783333697,
            frontImageUrl:
              "https://8nothtoc5ds7a0x3.public.blob.vercel-storage.com/graded-cards-renders/PSA120031882/nft_image.jpg"
          }
        ])
      ),
      pack: { slug: "renacrypt-pack", name: "RenaCrypt Pack" },
      fetchedAt: observedAt,
      sourceUrl: "https://www.renaiss.xyz/gacha/renacrypt-pack"
    });

    expect(parsed.activities).toHaveLength(1);
    expect(parsed.activities[0]?.fmvUsd).toBe("115.50");
    expect(parsed.activities[0]?.psaId).toBe("120031882");
    expect(parsed.activities[0]?.pulledAt).toBe("2026-07-06T10:28:17.000Z");
    expect(parsed.activities[0]?.metadata["observedIntervalNotOfficialOdds"]).toBe(true);
  });

  it("converts $n FMV cents and extracts PSA IDs directly", () => {
    expect(parseRenaissFmvCents("$n11550")).toBe("115.50");
    expect(parseRenaissFmvCents("$n4900")).toBe("49.00");
    expect(
      extractPsaIdFromImageUrl("https://example.com/graded-cards-renders/PSA147956474/nft_image.jpg")
    ).toBe("147956474");
    expect(
      extractPsaIdFromImageUrl("https://example.com/graded-cards-renders/CGC6103474033/nft_image.jpg")
    ).toBeNull();
  });
});

describe("Renaiss gacha connector", () => {
  it("dual-fetches packs and unions activities by ID", async () => {
    const requests: string[] = [];
    const duplicate = {
      id: "shared-pull",
      tier: "common",
      fmv: "$n7350",
      pulledAtTimestamp: 1783332952,
      frontImageUrl:
        "https://8nothtoc5ds7a0x3.public.blob.vercel-storage.com/graded-cards-renders/PSA110247220/nft_image_silver.jpg"
    };
    const connector = createRenaissGachaConnector({
      baseUrl: "https://www.renaiss.xyz/gacha",
      packs: [
        { slug: "renacrypt-pack", name: "RenaCrypt Pack" },
        { slug: "omega", name: "OMEGA" }
      ],
      rateLimitMs: 0,
      retryAttempts: 1,
      retryBaseDelayMs: 0,
      fetch: async (input) => {
        const url = String(input);
        requests.push(url);
        const omega = url.endsWith("/omega");
        const activities = omega
          ? [
              duplicate,
              {
                id: "omega-only",
                tier: "B",
                fmv: "$n6325",
                pulledAtTimestamp: 1783333697,
                frontImageUrl:
                  "https://8nothtoc5ds7a0x3.public.blob.vercel-storage.com/graded-cards-renders/PSA139575654/nft_image.jpg"
              }
            ]
          : [duplicate];

        return new Response(rscFixture(JSON.stringify(activities)), {
          status: 200,
          headers: { "content-type": "text/x-component" }
        });
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

    expect(requests).toEqual([
      "https://www.renaiss.xyz/gacha/renacrypt-pack",
      "https://www.renaiss.xyz/gacha/omega"
    ]);
    expect(result.source).toBe("renaiss_gacha_rsc");
    expect(result.data.pages).toHaveLength(2);
    expect(result.data.activities.map((activity) => activity.activityId).sort()).toEqual([
      "omega-only",
      "shared-pull"
    ]);
    expect(
      result.data.dataQualityEvents.some(
        (event) => event.code === "gacha_activity_duplicate_across_packs"
      )
    ).toBe(true);
  });
});
