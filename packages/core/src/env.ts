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

export const RuntimeEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  JOB_SECRET: z.string().min(24, "JOB_SECRET must be at least 24 characters"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  RENAISS_MARKETPLACE_STRATEGY: RenaissMarketplaceStrategySchema.default("auto"),
  RENAISS_V0_MARKETPLACE_URL: z.string().url(),
  RENAISS_TRPC_MARKETPLACE_URL: z.string().url(),
  AI_ENABLED: booleanFlag,
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  MIMO_API_KEY: z.string().optional(),
  DISCORD_ENABLED: booleanFlag,
  DISCORD_APPLICATION_ID: z.string().optional(),
  DISCORD_PUBLIC_KEY: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  SENTRY_DSN: optionalUrl,
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
