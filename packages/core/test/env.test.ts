import { describe, expect, it } from "vitest";

import { parseRuntimeEnv } from "../src/env.js";

describe("parseRuntimeEnv", () => {
  it("accepts the required scaffold environment contract", () => {
    const env = parseRuntimeEnv({
      DATABASE_URL: "postgres://atlas:atlas@localhost:5432/atlas",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      JOB_SECRET: "replace-with-strong-random-value",
      RENAISS_V0_MARKETPLACE_URL: "https://api.renaiss.xyz/v0/marketplace",
      RENAISS_TRPC_MARKETPLACE_URL: "https://www.renaiss.xyz/api/trpc/collectible.list",
      GACHA_SYNC_ENABLED: "true",
      UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      UPSTASH_REDIS_REST_TOKEN: "redis-token",
      AI_ENABLED: "false",
      DISCORD_ENABLED: "false",
      DEMO_MODE: "true",
      MOCK_EXTERNAL_COMPS: "true"
    });

    expect(env.RENAISS_MARKETPLACE_STRATEGY).toBe("auto");
    expect(env.UPSTASH_REDIS_REST_URL).toBe("https://redis.example.com");
    expect(env.AI_ENABLED).toBe(false);
    expect(env.AI_PROVIDER).toBe("auto");
    expect(env.OPENAI_BASE_URL).toBe("https://api.openai.com/v1");
    expect(env.MIMO_MODEL).toBe("mimo-v2.5");
    expect(env.GACHA_PACKS).toBe("renacrypt-pack,omega");
    expect(env.GACHA_RSC_BASE_URL).toBe("https://www.renaiss.xyz/gacha");
    expect(env.DEMO_MODE).toBe(true);
  });

  it("rejects missing secrets instead of falling back silently", () => {
    expect(() =>
      parseRuntimeEnv({
        DATABASE_URL: "",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        JOB_SECRET: "short",
        RENAISS_V0_MARKETPLACE_URL: "https://api.renaiss.xyz/v0/marketplace",
        RENAISS_TRPC_MARKETPLACE_URL: "https://www.renaiss.xyz/api/trpc/collectible.list"
      })
    ).toThrow();
  });
});
