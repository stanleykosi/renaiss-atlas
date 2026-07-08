import { z } from "zod";

function cleanEnvString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  return trimmed.length === 0 ? undefined : trimmed;
}

const EmptyToUndefined = z.preprocess(cleanEnvString, z.string().optional());

const OptionalUrl = z.preprocess(cleanEnvString, z.string().url().optional());

const RedisEnvSchema = z.object({
  UPSTASH_REDIS_REST_URL: OptionalUrl,
  UPSTASH_REDIS_REST_TOKEN: EmptyToUndefined
});

type RedisConfig = {
  url: string;
  token: string;
};

const RedisResponseSchema = z
  .object({
    result: z.unknown().optional(),
    error: z.string().optional()
  })
  .passthrough();

function redisConfig(env: Record<string, string | undefined> = process.env): RedisConfig | null {
  const parsed = RedisEnvSchema.safeParse(env);
  if (!parsed.success) return null;

  const url = parsed.data.UPSTASH_REDIS_REST_URL;
  const token = parsed.data.UPSTASH_REDIS_REST_TOKEN;
  if (url == null || token == null) return null;

  return {
    url: url.replace(/\/+$/, ""),
    token
  };
}

async function redisCommand(command: unknown[], env?: Record<string, string | undefined>): Promise<unknown> {
  const config = redisConfig(env);
  if (config == null) return null;

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command),
    cache: "no-store"
  });

  const parsed = RedisResponseSchema.safeParse(await response.json().catch(() => null));
  if (!response.ok || !parsed.success || parsed.data.error != null) return null;
  return parsed.data.result ?? null;
}

export async function redisGetString(key: string, env?: Record<string, string | undefined>): Promise<string | null> {
  const result = await redisCommand(["GET", key], env).catch(() => null);
  return typeof result === "string" ? result : null;
}

export async function redisSetJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
  env?: Record<string, string | undefined>
): Promise<void> {
  if (ttlSeconds <= 0) return;
  await redisCommand(["SET", key, JSON.stringify(value), "EX", String(ttlSeconds)], env).catch(() => null);
}

export async function redisGetJson<T>(
  key: string,
  env?: Record<string, string | undefined>
): Promise<T | null> {
  const value = await redisGetString(key, env);
  if (value == null) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
