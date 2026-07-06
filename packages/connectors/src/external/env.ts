import { z } from "zod";

import type { ExternalCompEnvConfig, ExternalCompSourcePlatform } from "./types.js";

const booleanFromEnv = z.preprocess(
  (value) => (value == null || value === "" ? "false" : value),
  z.enum(["true", "false"]).transform((value) => value === "true")
);

const integerFromEnv = (defaultValue: number, min: number, max: number) =>
  z.preprocess(
    (value) => (value == null || value === "" ? String(defaultValue) : value),
    z.coerce.number().int().min(min).max(max)
  );

const numberFromEnv = (defaultValue: number, min: number, max: number) =>
  z.preprocess(
    (value) => (value == null || value === "" ? String(defaultValue) : value),
    z.coerce.number().min(min).max(max)
  );

const sourceSchema = z.enum(["snkrdunk", "pricecharting"]);

function parseSources(value: string): ExternalCompSourcePlatform[] {
  const sources = value
    .split(",")
    .map((source) => source.trim())
    .filter((source) => source.length > 0)
    .map((source) => sourceSchema.parse(source));

  return sources.length > 0 ? [...new Set(sources)] : ["snkrdunk", "pricecharting"];
}

export const ExternalCompEnvSchema = z.object({
  EXTERNAL_COMPS_ENABLED: booleanFromEnv.default(true),
  EXTERNAL_COMPS_LIVE_ENABLED: booleanFromEnv.default(false),
  EXTERNAL_COMP_SOURCES: z.string().default("snkrdunk,pricecharting"),
  EXTERNAL_COMP_BATCH_SIZE: integerFromEnv(25, 1, 500),
  EXTERNAL_COMP_STALE_DAYS: numberFromEnv(7, 0.1, 365),
  EXTERNAL_COMP_RATE_LIMIT_MS: integerFromEnv(750, 0, 60_000),
  EXTERNAL_COMP_RETRY_ATTEMPTS: integerFromEnv(3, 1, 10),
  JINA_READER_BASE_URL: z.string().url().default("https://r.jina.ai/"),
  SNKRDUNK_SEARCH_URL: z.string().url().default("https://snkrdunk.com/en/search/result"),
  PRICECHARTING_SEARCH_URL: z.string().url().default("https://www.pricecharting.com/search-products"),
  PRICECHARTING_API_URL: z.string().url().default("https://www.pricecharting.com/api/products"),
  PRICECHARTING_API_TOKEN: z.string().optional(),
  EXCHANGE_RATES_LIVE_ENABLED: booleanFromEnv.default(false),
  EXCHANGE_RATES_URL: z.string().url().default("https://open.er-api.com/v6/latest/USD")
});

export type ExternalCompEnv = z.infer<typeof ExternalCompEnvSchema>;

export function parseExternalCompEnv(input: Record<string, string | undefined>): ExternalCompEnv {
  return ExternalCompEnvSchema.parse(input);
}

export function externalCompConfigFromEnv(env: ExternalCompEnv): ExternalCompEnvConfig {
  return {
    enabled: env.EXTERNAL_COMPS_ENABLED,
    liveEnabled: env.EXTERNAL_COMPS_LIVE_ENABLED,
    sources: parseSources(env.EXTERNAL_COMP_SOURCES),
    batchSize: env.EXTERNAL_COMP_BATCH_SIZE,
    staleDays: env.EXTERNAL_COMP_STALE_DAYS,
    rateLimitMs: env.EXTERNAL_COMP_RATE_LIMIT_MS,
    retryAttempts: env.EXTERNAL_COMP_RETRY_ATTEMPTS,
    jinaReaderBaseUrl: env.JINA_READER_BASE_URL,
    snkrdunkBaseUrl: env.SNKRDUNK_SEARCH_URL,
    priceChartingBaseUrl: env.PRICECHARTING_SEARCH_URL,
    priceChartingApiUrl: env.PRICECHARTING_API_URL,
    priceChartingApiToken: env.PRICECHARTING_API_TOKEN ?? null,
    exchangeRatesLiveEnabled: env.EXCHANGE_RATES_LIVE_ENABLED,
    exchangeRatesUrl: env.EXCHANGE_RATES_URL
  };
}
