import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createRenaissOSClient } from "./client";

const clientEnv = {
  RENAISS_OS_BASE_URL: "https://api.renaissos.com",
  UPSTASH_REDIS_REST_URL: "https://redis.example.com",
  UPSTASH_REDIS_REST_TOKEN: "redis-token"
};

const ResponseSchema = z.object({ value: z.string() });

describe("Renaiss OS client cache failures", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("marks configured Redis failures as a bypass while preserving official data", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo) => {
        if (String(input) === clientEnv.UPSTASH_REDIS_REST_URL) {
          throw new Error("redis unavailable");
        }
        return Response.json({ value: "official" });
      })
    );

    const result = await createRenaissOSClient(clientEnv).getJson("/v1/test", ResponseSchema, {
      cacheTtlSeconds: 60
    });

    expect(result.data).toEqual({ value: "official" });
    expect(result.cacheStatus).toBe("bypass");
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("bypassing optional state"));
  });

  it("uses only schema-valid cache hits", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ result: JSON.stringify({ value: "cached" }) }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createRenaissOSClient(clientEnv).getJson("/v1/test", ResponseSchema, {
      cacheTtlSeconds: 60
    });

    expect(result.data).toEqual({ value: "cached" });
    expect(result.cacheStatus).toBe("hit");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
