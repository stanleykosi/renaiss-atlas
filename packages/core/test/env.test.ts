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
      OPENROUTER_API_KEY: "openrouter-key",
      OPENROUTER_MODEL: "openrouter/model"
    });

    expect(env.RENAISS_OS_BASE_URL).toBe("https://api.renaissos.com");
    expect(env.UPSTASH_REDIS_REST_URL).toBe("https://redis.example.com");
    expect(env.OPENROUTER_API_KEY).toBe("openrouter-key");
    expect(env.OPENROUTER_MODEL).toBe("openrouter/model");
  });

  it("rejects missing official API deployment requirements", () => {
    expect(() =>
      parseRuntimeEnv({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        RENAISS_OS_BASE_URL: "https://api.renaissos.com"
      })
    ).toThrow();
  });

  it("requires the official API base URL", () => {
    expect(() =>
      parseRuntimeEnv({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        UPSTASH_REDIS_REST_URL: "https://redis.example.com",
        UPSTASH_REDIS_REST_TOKEN: "redis-token",
        OPENROUTER_API_KEY: "openrouter-key",
        OPENROUTER_MODEL: "openrouter/model"
      })
    ).toThrow();
  });

  it("trims surrounding quotes from deployment env values", () => {
    const env = parseRuntimeEnv({
      NEXT_PUBLIC_APP_URL: '"https://atlas.example.com"',
      RENAISS_OS_BASE_URL: '"https://api.renaissos.com"',
      UPSTASH_REDIS_REST_URL: '"https://redis.example.com"',
      UPSTASH_REDIS_REST_TOKEN: '"redis-token"',
      OPENROUTER_API_KEY: '"openrouter-key"',
      OPENROUTER_MODEL: '"openrouter/model"'
    });

    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://atlas.example.com");
    expect(env.UPSTASH_REDIS_REST_URL).toBe("https://redis.example.com");
    expect(env.OPENROUTER_MODEL).toBe("openrouter/model");
  });
});
