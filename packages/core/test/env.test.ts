import { describe, expect, it } from "vitest";

import { parseRuntimeEnv } from "../src/env.js";

describe("parseRuntimeEnv", () => {
  it("accepts the official API runtime environment contract", () => {
    const env = parseRuntimeEnv({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      RENAISS_OS_BASE_URL: "https://api.renaissos.com",
      RENAISS_OS_API_KEY: "test-key",
      RENAISS_OS_API_SECRET: "test-secret",
      UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      UPSTASH_REDIS_REST_TOKEN: "redis-token",
      AI_ENABLED: "false"
    });

    expect(env.RENAISS_OS_BASE_URL).toBe("https://api.renaissos.com");
    expect(env.UPSTASH_REDIS_REST_URL).toBe("https://redis.example.com");
    expect(env.AI_ENABLED).toBe(false);
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
    expect(env.OPENROUTER_MODEL).toBeUndefined();
  });

  it("rejects missing official API deployment requirements", () => {
    expect(() =>
      parseRuntimeEnv({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        RENAISS_OS_BASE_URL: "https://api.renaissos.com",
        AI_ENABLED: "false"
      })
    ).toThrow();
  });
});
