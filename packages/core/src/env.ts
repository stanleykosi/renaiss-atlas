import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional()
);

const booleanFlag = z.preprocess(
  (value) => (value === undefined ? "false" : value),
  z.enum(["true", "false"]).transform((value) => value === "true")
);

export const RenaissMarketplaceStrategySchema = z.enum(["auto", "v0", "trpc"]);
export const AiProviderStrategySchema = z.enum(["auto", "openai", "mimo", "deterministic"]);

export const RuntimeEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  JOB_SECRET: z.string().min(24, "JOB_SECRET must be at least 24 characters"),
  JOB_LOCK_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(900),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  INTENT_RATE_LIMIT_REDIS_REST_URL: optionalUrl,
  INTENT_RATE_LIMIT_REDIS_REST_TOKEN: z.string().optional(),
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RENAISS_MARKETPLACE_STRATEGY: RenaissMarketplaceStrategySchema.default("auto"),
  RENAISS_V0_MARKETPLACE_URL: z.string().url(),
  RENAISS_TRPC_MARKETPLACE_URL: z.string().url(),
  GACHA_SYNC_ENABLED: booleanFlag,
  GACHA_PACKS: z.string().min(1).default("renacrypt-pack,omega"),
  GACHA_RSC_BASE_URL: z.string().url().default("https://www.renaiss.xyz/gacha"),
  GACHA_SYNC_RATE_LIMIT_MS: z.coerce.number().int().min(0).max(60_000).default(750),
  GACHA_SYNC_RETRY_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  EXTERNAL_COMPS_ENABLED: booleanFlag,
  EXTERNAL_COMPS_LIVE_ENABLED: booleanFlag,
  EXTERNAL_COMP_SOURCES: z.string().min(1).default("snkrdunk,pricecharting"),
  EXTERNAL_COMP_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(25),
  EXTERNAL_COMP_STALE_DAYS: z.coerce.number().min(0.1).max(365).default(7),
  EXTERNAL_COMP_RATE_LIMIT_MS: z.coerce.number().int().min(0).max(60_000).default(750),
  EXTERNAL_COMP_RETRY_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  JINA_READER_BASE_URL: z.string().url().default("https://r.jina.ai/"),
  SNKRDUNK_SEARCH_URL: z.string().url().default("https://snkrdunk.com/en/search/result"),
  PRICECHARTING_SEARCH_URL: z.string().url().default("https://www.pricecharting.com/search-products"),
  PRICECHARTING_API_URL: z.string().url().default("https://www.pricecharting.com/api/products"),
  PRICECHARTING_API_TOKEN: z.string().optional(),
  EXCHANGE_RATES_LIVE_ENABLED: booleanFlag,
  EXCHANGE_RATES_URL: z.string().url().default("https://open.er-api.com/v6/latest/USD"),
  AI_ENABLED: booleanFlag,
  AI_PROVIDER: AiProviderStrategySchema.default("auto"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  MIMO_API_KEY: z.string().optional(),
  MIMO_BASE_URL: z.string().url().default("https://token-plan-cn.xiaomimimo.com/v1"),
  MIMO_MODEL: z.string().min(1).default("mimo-v2.5"),
  DISCORD_ENABLED: booleanFlag,
  DISCORD_APPLICATION_ID: z.string().optional(),
  DISCORD_PUBLIC_KEY: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  SENTRY_DSN: optionalUrl,
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  DEMO_MODE: z.preprocess(
    (value) => (value === undefined ? "true" : value),
    z.enum(["true", "false"]).transform((value) => value === "true")
  ),
  MOCK_EXTERNAL_COMPS: z.preprocess(
    (value) => (value === undefined ? "true" : value),
    z.enum(["true", "false"]).transform((value) => value === "true")
  )
});

export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

export function parseRuntimeEnv(input: Record<string, string | undefined>): RuntimeEnv {
  return RuntimeEnvSchema.parse(input);
}
