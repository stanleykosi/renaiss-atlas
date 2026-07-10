import { z } from "zod";

export function cleanEnvString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  return trimmed.length === 0 ? undefined : trimmed;
}

const optionalString = z.preprocess(cleanEnvString, z.string().optional());
const requiredString = z.preprocess(cleanEnvString, z.string().min(1));
const optionalUrl = z.preprocess(cleanEnvString, z.string().url().optional());
const requiredUrl = z.preprocess(cleanEnvString, z.string().url());

export const RuntimeEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: requiredUrl,
  UPSTASH_REDIS_REST_URL: requiredUrl,
  UPSTASH_REDIS_REST_TOKEN: requiredString,
  RENAISS_OS_BASE_URL: requiredUrl,
  RENAISS_OS_API_KEY: optionalString,
  RENAISS_OS_API_SECRET: optionalString,
  OPENROUTER_API_KEY: requiredString,
  OPENROUTER_MODEL: requiredString,
  DISCORD_PUBLIC_KEY: optionalString,
  DISCORD_APPLICATION_ID: optionalString,
  DISCORD_BOT_TOKEN: optionalString,
  DISCORD_GUILD_ID: optionalString,
  SENTRY_DSN: optionalUrl,
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
  SENTRY_ORG: optionalString,
  SENTRY_PROJECT: optionalString,
  SENTRY_AUTH_TOKEN: optionalString,
  SENTRY_ENVIRONMENT: optionalString
});

export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

export function parseRuntimeEnv(input: Record<string, string | undefined>): RuntimeEnv {
  return RuntimeEnvSchema.parse(input);
}
