import { z } from "zod";

import { RENAISS_GACHA_PACKS } from "./gacha.connector.js";
import type { RenaissGachaConfig, RenaissMarketplaceConfig } from "./types.js";

const booleanFromEnv = z.preprocess(
  (value) => (value == null || value === "" ? "true" : value),
  z.enum(["true", "false"]).transform((value) => value === "true")
);

const integerFromEnv = (defaultValue: number, min: number, max: number) =>
  z.preprocess(
    (value) => (value == null || value === "" ? String(defaultValue) : value),
    z.coerce.number().int().min(min).max(max)
  );

export const RenaissMarketplaceEnvSchema = z.object({
  RENAISS_MARKETPLACE_STRATEGY: z.enum(["auto", "v0", "trpc"]).default("auto"),
  RENAISS_V0_MARKETPLACE_URL: z
    .string()
    .url()
    .default("https://api.renaiss.xyz/v0/marketplace"),
  RENAISS_TRPC_MARKETPLACE_URL: z
    .string()
    .url()
    .default("https://www.renaiss.xyz/api/trpc/collectible.list"),
  RENAISS_SYNC_LIMIT: integerFromEnv(5000, 1, 100_000),
  RENAISS_SYNC_PAGE_SIZE: integerFromEnv(50, 1, 100),
  RENAISS_SYNC_MAX_PAGES: integerFromEnv(100, 1, 1000),
  RENAISS_SYNC_LISTED_ONLY: booleanFromEnv.default(true),
  RENAISS_SYNC_RATE_LIMIT_MS: integerFromEnv(750, 0, 60_000),
  RENAISS_SYNC_RETRY_ATTEMPTS: integerFromEnv(3, 1, 10)
});

export type RenaissMarketplaceEnv = z.infer<typeof RenaissMarketplaceEnvSchema>;

export function parseRenaissMarketplaceEnv(
  input: Record<string, string | undefined>
): RenaissMarketplaceEnv {
  return RenaissMarketplaceEnvSchema.parse(input);
}

export function marketplaceConfigFromEnv(
  env: RenaissMarketplaceEnv,
  fetchImpl: RenaissMarketplaceConfig["fetch"] = fetch
): RenaissMarketplaceConfig {
  const maxPagesFromLimit = Math.ceil(env.RENAISS_SYNC_LIMIT / env.RENAISS_SYNC_PAGE_SIZE);

  return {
    strategy: env.RENAISS_MARKETPLACE_STRATEGY,
    v0Url: env.RENAISS_V0_MARKETPLACE_URL,
    trpcUrl: env.RENAISS_TRPC_MARKETPLACE_URL,
    pageSize: env.RENAISS_SYNC_PAGE_SIZE,
    maxPages: Math.min(env.RENAISS_SYNC_MAX_PAGES, Math.max(1, maxPagesFromLimit)),
    listedOnly: env.RENAISS_SYNC_LISTED_ONLY,
    rateLimitMs: env.RENAISS_SYNC_RATE_LIMIT_MS,
    retryAttempts: env.RENAISS_SYNC_RETRY_ATTEMPTS,
    retryBaseDelayMs: 500,
    fetch: fetchImpl
  };
}

function packDefinitionsFromEnv(value: string): RenaissGachaConfig["packs"] {
  const knownPacks = new Map<string, RenaissGachaConfig["packs"][number]>(
    RENAISS_GACHA_PACKS.map((pack) => [pack.slug, pack])
  );
  const unknownSlugs: string[] = [];

  const packs = value
    .split(",")
    .map((slug) => slug.trim())
    .filter((slug) => slug.length > 0)
    .flatMap((slug) => {
      const pack = knownPacks.get(slug);
      if (pack == null) {
        unknownSlugs.push(slug);
        return [];
      }

      return [{ ...pack }];
    });

  if (unknownSlugs.length > 0) {
    throw new Error(`Unknown Renaiss gacha pack slug(s): ${unknownSlugs.join(", ")}`);
  }

  return packs.length > 0 ? packs : [...RENAISS_GACHA_PACKS];
}

export const RenaissGachaEnvSchema = z.object({
  GACHA_SYNC_ENABLED: booleanFromEnv.default(true),
  GACHA_PACKS: z.string().default(RENAISS_GACHA_PACKS.map((pack) => pack.slug).join(",")),
  GACHA_RSC_BASE_URL: z.string().url().default("https://www.renaiss.xyz/gacha"),
  GACHA_SYNC_RATE_LIMIT_MS: integerFromEnv(750, 0, 60_000),
  GACHA_SYNC_RETRY_ATTEMPTS: integerFromEnv(3, 1, 10)
});

export type RenaissGachaEnv = z.infer<typeof RenaissGachaEnvSchema>;

export function parseRenaissGachaEnv(input: Record<string, string | undefined>): RenaissGachaEnv {
  return RenaissGachaEnvSchema.parse(input);
}

export function gachaConfigFromEnv(
  env: RenaissGachaEnv,
  fetchImpl: RenaissGachaConfig["fetch"] = fetch
): RenaissGachaConfig {
  return {
    baseUrl: env.GACHA_RSC_BASE_URL,
    packs: packDefinitionsFromEnv(env.GACHA_PACKS),
    rateLimitMs: env.GACHA_SYNC_RATE_LIMIT_MS,
    retryAttempts: env.GACHA_SYNC_RETRY_ATTEMPTS,
    retryBaseDelayMs: 500,
    fetch: fetchImpl
  };
}
