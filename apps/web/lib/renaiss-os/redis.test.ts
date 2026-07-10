import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { redisGetJson, redisSetJson } from "./redis";

const redisEnv = {
  UPSTASH_REDIS_REST_URL: "https://redis.example.com",
  UPSTASH_REDIS_REST_TOKEN: "redis-token"
};

const CachedCardSchema = z.object({ card: z.string() }).strict();

function redisResponse(result: unknown, status = 200): Response {
  return Response.json(result, { status });
}

describe("Renaiss OS Redis state", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("distinguishes intentionally disabled Redis from a cache miss", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(redisGetJson("key", CachedCardSchema, {})).resolves.toEqual({
      status: "disabled"
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports partial configuration as an explicit error", async () => {
    const result = await redisGetJson("key", CachedCardSchema, {
      UPSTASH_REDIS_REST_URL: redisEnv.UPSTASH_REDIS_REST_URL
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error.message).toContain("requires both URL and token");
    }
  });

  it("distinguishes a Redis miss from a configured transport failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(redisResponse({ result: null })));
    await expect(redisGetJson("key", CachedCardSchema, redisEnv)).resolves.toEqual({
      status: "miss"
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network unavailable")));
    const result = await redisGetJson("key", CachedCardSchema, redisEnv);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error.message).toBe("network unavailable");
    }
  });

  it("reports HTTP, response-schema, and corrupt JSON failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(redisResponse({}, 503)));
    await expect(redisGetJson("key", CachedCardSchema, redisEnv)).resolves.toMatchObject({
      status: "error",
      error: expect.objectContaining({ message: "Upstash Redis request failed with 503." })
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(redisResponse({ result: 42 })));
    await expect(redisGetJson("key", CachedCardSchema, redisEnv)).resolves.toMatchObject({
      status: "error",
      error: expect.objectContaining({
        message: "Upstash Redis returned an unexpected GET result."
      })
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(redisResponse({ result: "not-json" })));
    await expect(redisGetJson("key", CachedCardSchema, redisEnv)).resolves.toMatchObject({
      status: "error"
    });
  });

  it("returns validated transport JSON as a cache hit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(redisResponse({ result: JSON.stringify({ card: "official" }) }))
    );

    await expect(redisGetJson("key", CachedCardSchema, redisEnv)).resolves.toEqual({
      status: "hit",
      value: { card: "official" }
    });
  });

  it("reports schema-invalid cached JSON as an explicit error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(redisResponse({ result: JSON.stringify({ card: 42 }) }))
    );

    await expect(redisGetJson("key", CachedCardSchema, redisEnv)).resolves.toMatchObject({
      status: "error",
      error: expect.objectContaining({
        message: "Cached Redis JSON failed schema validation."
      })
    });
  });

  it("reports write failures and rejects invalid TTLs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(redisResponse({ result: "NOPE" })));
    await expect(redisSetJson("key", { card: "official" }, 60, redisEnv)).resolves.toMatchObject({
      status: "error",
      error: expect.objectContaining({
        message: "Upstash Redis returned an unexpected SET result."
      })
    });

    await expect(redisSetJson("key", {}, 0, redisEnv)).rejects.toThrow(
      "Redis JSON TTL must be a positive integer."
    );
  });
});
