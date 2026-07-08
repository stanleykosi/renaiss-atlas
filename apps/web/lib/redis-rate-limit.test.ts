import { afterEach, describe, expect, it, vi } from "vitest";

import { checkAdminSyncRateLimit, checkIntentRateLimit } from "./redis-rate-limit";

describe("checkIntentRateLimit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows demo mode without Redis configuration", async () => {
    await expect(
      checkIntentRateLimit({
        identifier: "local",
        env: { DEMO_MODE: "true" },
        now: 1_000
      })
    ).resolves.toMatchObject({
      status: "allowed",
      source: "demo"
    });
  });

  it("fails closed outside demo mode when Redis is missing", async () => {
    await expect(
      checkIntentRateLimit({
        identifier: "collector",
        env: { DEMO_MODE: "false" }
      })
    ).resolves.toMatchObject({
      status: "unavailable"
    });
  });

  it("uses Redis REST for shared fixed-window limiting", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ result: [0, 6, 12_345] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkIntentRateLimit({
      identifier: "192.0.2.1",
      env: {
        DEMO_MODE: "false",
        UPSTASH_REDIS_REST_URL: "https://redis.example.com/",
        UPSTASH_REDIS_REST_TOKEN: "test-token"
      },
      now: 1_000
    });

    expect(result).toEqual({
      status: "limited",
      retryAfterSeconds: 13,
      resetAt: 13_345,
      source: "redis"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rate-limits admin sync requests with the shared Redis window", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ result: [1, 3, 25_000] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkAdminSyncRateLimit({
      identifier: "operator",
      env: {
        DEMO_MODE: "false",
        UPSTASH_REDIS_REST_URL: "https://redis.example.com",
        UPSTASH_REDIS_REST_TOKEN: "test-token"
      },
      now: 2_000
    });

    expect(result).toEqual({
      status: "allowed",
      remaining: 7,
      resetAt: 27_000,
      source: "redis"
    });
  });
});
