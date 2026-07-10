import { z } from "zod";

import { cleanEnvString } from "@renaiss/core";

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

type RedisCommand =
  | readonly [operation: "GET", key: string]
  | readonly [operation: "SET", key: string, value: string, expiryMode: "EX", ttlSeconds: string];

type RedisCommandResult = { status: "disabled" } | { status: "success"; value: unknown };

export type RedisReadResult<Value> =
  | { status: "disabled" | "miss" }
  | { status: "hit"; value: Value }
  | { status: "error"; error: Error };

export type RedisWriteResult =
  | { status: "disabled" | "written" }
  | { status: "error"; error: Error };

const RedisResponseSchema = z.object({
  result: z.unknown().optional(),
  error: z.string().optional()
});

function redisConfig(env: Record<string, string | undefined> = process.env): RedisConfig | null {
  const parsed = RedisEnvSchema.parse(env);
  const url = parsed.UPSTASH_REDIS_REST_URL;
  const token = parsed.UPSTASH_REDIS_REST_TOKEN;
  if (url == null && token == null) return null;
  if (url == null || token == null) {
    throw new Error("Upstash Redis configuration requires both URL and token.");
  }

  return {
    url: url.replace(/\/+$/, ""),
    token
  };
}

function asError(error: unknown, message: string): Error {
  return error instanceof Error ? error : new Error(message, { cause: error });
}

async function redisCommand(
  command: RedisCommand,
  env?: Record<string, string | undefined>
): Promise<RedisCommandResult> {
  const config = redisConfig(env);
  if (config == null) return { status: "disabled" };

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Upstash Redis request failed with ${response.status}.`);
  }

  const parsed = RedisResponseSchema.parse(await response.json());
  if (parsed.error != null) {
    throw new Error("Upstash Redis returned an operation error.");
  }

  return { status: "success", value: parsed.result ?? null };
}

export async function redisSetJson(
  key: string,
  value: object,
  ttlSeconds: number,
  env?: Record<string, string | undefined>
): Promise<RedisWriteResult> {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new RangeError("Redis JSON TTL must be a positive integer.");
  }

  try {
    const serialized = JSON.stringify(value);
    const result = await redisCommand(["SET", key, serialized, "EX", String(ttlSeconds)], env);
    if (result.status === "disabled") return result;
    if (result.value !== "OK") {
      throw new Error("Upstash Redis returned an unexpected SET result.");
    }
    return { status: "written" };
  } catch (error) {
    return { status: "error", error: asError(error, "Redis JSON write failed.") };
  }
}

export async function redisGetJson<Output>(
  key: string,
  schema: z.ZodType<Output, z.ZodTypeDef, unknown>,
  env?: Record<string, string | undefined>
): Promise<RedisReadResult<Output>> {
  try {
    const result = await redisCommand(["GET", key], env);
    if (result.status === "disabled") return result;
    if (result.value == null) return { status: "miss" };
    if (typeof result.value !== "string") {
      throw new Error("Upstash Redis returned an unexpected GET result.");
    }
    const json: unknown = JSON.parse(result.value);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new Error("Cached Redis JSON failed schema validation.", { cause: parsed.error });
    }
    return { status: "hit", value: parsed.data };
  } catch (error) {
    return { status: "error", error: asError(error, "Redis JSON read failed.") };
  }
}
