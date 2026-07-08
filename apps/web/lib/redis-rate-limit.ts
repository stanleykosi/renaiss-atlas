import { createHash } from "node:crypto";
import { z } from "zod";

import { allowSeedData } from "./data-mode";

const INTENT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const INTENT_RATE_LIMIT_MAX_WRITES = 5;
const ADMIN_SYNC_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const ADMIN_SYNC_RATE_LIMIT_MAX_WRITES = 10;
const REDIS_UNAVAILABLE_RETRY_SECONDS = 60;

const EmptyToUndefined = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().optional()
);

const OptionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().url().optional()
);

const RedisRateLimitEnvSchema = z.object({
  INTENT_RATE_LIMIT_REDIS_REST_URL: OptionalUrl,
  INTENT_RATE_LIMIT_REDIS_REST_TOKEN: EmptyToUndefined,
  UPSTASH_REDIS_REST_URL: OptionalUrl,
  UPSTASH_REDIS_REST_TOKEN: EmptyToUndefined,
  ALLOW_SEED_DATA: z.enum(["true", "false"]).optional()
});

const RedisRestResponseSchema = z
  .object({
    result: z.unknown().optional(),
    error: z.string().optional()
  })
  .passthrough();

const FixedWindowScript = [
  'local count = redis.call("INCR", KEYS[1])',
  "if count == 1 then",
  '  redis.call("PEXPIRE", KEYS[1], ARGV[2])',
  "end",
  'local ttl = redis.call("PTTL", KEYS[1])',
  "if ttl < 0 then",
  '  redis.call("PEXPIRE", KEYS[1], ARGV[2])',
  "  ttl = tonumber(ARGV[2])",
  "end",
  "local allowed = 0",
  "if count <= tonumber(ARGV[1]) then",
  "  allowed = 1",
  "end",
  "return {allowed, count, ttl}"
].join("\n");

type RedisRateLimitConfig = {
  url: string;
  token: string;
};

export type FixedWindowRateLimitResult =
  | {
      status: "allowed";
      remaining: number;
      resetAt: number;
      source: "redis" | "seed";
    }
  | {
      status: "limited";
      retryAfterSeconds: number;
      resetAt: number;
      source: "redis";
    }
  | {
      status: "unavailable";
      retryAfterSeconds: number;
      reason: string;
    };

export type IntentRateLimitResult = FixedWindowRateLimitResult;

function redisConfigFromEnv(input: Record<string, string | undefined>): RedisRateLimitConfig | null {
  const parsed = RedisRateLimitEnvSchema.safeParse(input);
  if (!parsed.success) return null;

  const url = parsed.data.INTENT_RATE_LIMIT_REDIS_REST_URL ?? parsed.data.UPSTASH_REDIS_REST_URL;
  const token = parsed.data.INTENT_RATE_LIMIT_REDIS_REST_TOKEN ?? parsed.data.UPSTASH_REDIS_REST_TOKEN;

  if (url == null || token == null) return null;

  return {
    url: url.replace(/\/+$/, ""),
    token
  };
}

function hashIdentifier(identifier: string): string {
  return createHash("sha256").update(identifier).digest("hex").slice(0, 32);
}

function keyForIdentifier(namespace: string, identifier: string): string {
  return `renaiss-atlas:${namespace}:${hashIdentifier(identifier)}`;
}

function numberFromRedisResult(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error("Redis rate limit returned a non-numeric result.");
  }
  return number;
}

async function executeRedisCommand(config: RedisRateLimitConfig, command: unknown[]): Promise<unknown> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command),
    cache: "no-store"
  });

  const body: unknown = await response.json().catch(() => null);
  const parsed = RedisRestResponseSchema.safeParse(body);

  if (!response.ok) {
    throw new Error("Redis rate limit request failed.");
  }

  if (!parsed.success) {
    throw new Error("Redis rate limit returned an invalid response.");
  }

  if (parsed.data.error != null) {
    throw new Error(`Redis rate limit error: ${parsed.data.error}`);
  }

  return parsed.data.result;
}

export async function checkFixedWindowRateLimit({
  namespace,
  identifier,
  max,
  windowMs,
  env = process.env,
  now = Date.now()
}: {
  namespace: string;
  identifier: string;
  max: number;
  windowMs: number;
  env?: Record<string, string | undefined>;
  now?: number;
}): Promise<FixedWindowRateLimitResult> {
  const config = redisConfigFromEnv(env);

  if (config == null) {
    if (allowSeedData(env)) {
      return {
        status: "allowed",
        remaining: max,
        resetAt: now + windowMs,
        source: "seed"
      };
    }

    return {
      status: "unavailable",
      retryAfterSeconds: REDIS_UNAVAILABLE_RETRY_SECONDS,
      reason: "Redis rate limiting is not configured."
    };
  }

  try {
    const result = await executeRedisCommand(config, [
      "EVAL",
      FixedWindowScript,
      "1",
      keyForIdentifier(namespace, identifier),
      String(max),
      String(windowMs)
    ]);

    if (!Array.isArray(result)) {
      throw new Error("Redis rate limit returned an invalid tuple.");
    }

    const allowed = numberFromRedisResult(result[0]) === 1;
    const count = numberFromRedisResult(result[1]);
    const ttlMs = Math.max(0, numberFromRedisResult(result[2]));
    const resetAt = now + ttlMs;

    if (!allowed) {
      return {
        status: "limited",
        retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
        resetAt,
        source: "redis"
      };
    }

    return {
      status: "allowed",
      remaining: Math.max(0, max - count),
      resetAt,
      source: "redis"
    };
  } catch {
    return {
      status: "unavailable",
      retryAfterSeconds: REDIS_UNAVAILABLE_RETRY_SECONDS,
      reason: "Redis rate limiting is unavailable."
    };
  }
}

export function checkIntentRateLimit(input: {
  identifier: string;
  env?: Record<string, string | undefined>;
  now?: number;
}): Promise<IntentRateLimitResult> {
  return checkFixedWindowRateLimit({
    namespace: "intents:create",
    identifier: input.identifier,
    max: INTENT_RATE_LIMIT_MAX_WRITES,
    windowMs: INTENT_RATE_LIMIT_WINDOW_MS,
    ...(input.env == null ? {} : { env: input.env }),
    ...(input.now == null ? {} : { now: input.now })
  });
}

export function checkAdminSyncRateLimit(input: {
  identifier: string;
  env?: Record<string, string | undefined>;
  now?: number;
}): Promise<FixedWindowRateLimitResult> {
  return checkFixedWindowRateLimit({
    namespace: "admin:sync",
    identifier: input.identifier,
    max: ADMIN_SYNC_RATE_LIMIT_MAX_WRITES,
    windowMs: ADMIN_SYNC_RATE_LIMIT_WINDOW_MS,
    ...(input.env == null ? {} : { env: input.env }),
    ...(input.now == null ? {} : { now: input.now })
  });
}
