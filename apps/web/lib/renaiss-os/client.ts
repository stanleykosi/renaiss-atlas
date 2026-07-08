import { createHash } from "node:crypto";
import { z } from "zod";

import {
  RenaissOsCardDetailSchema,
  RenaissOsFeaturedResponseSchema,
  RenaissOsFmvSeriesResponseSchema,
  RenaissOsGradedLookupSchema,
  RenaissOsIndexDetailSchema,
  RenaissOsIndicesResponseSchema,
  RenaissOsRecentTradesResponseSchema,
  RenaissOsSearchResponseSchema,
  RenaissOsSeriesResponseSchema,
  RenaissOsSetResponseSchema,
  RenaissOsTradesResponseSchema
} from "./schemas";
import { redisGetJson, redisSetJson } from "./redis";

const RenaissOsEnvSchema = z.object({
  RENAISS_OS_BASE_URL: z
    .preprocess(
      (value) => (value === "" || value == null ? "https://api.renaissos.com" : value),
      z.string().url()
    ),
  RENAISS_OS_API_KEY: z.string().optional(),
  RENAISS_OS_API_SECRET: z.string().optional()
});

export type RenaissOsRateLimit = {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
  retryAfterSeconds: number | null;
};

export type RenaissOsRequestResult<T> = {
  data: T;
  rateLimit: RenaissOsRateLimit;
  cacheStatus: "hit" | "miss" | "bypass";
};

export class RenaissOsClientError extends Error {
  readonly status: number;
  readonly rateLimit: RenaissOsRateLimit;

  constructor(message: string, status: number, rateLimit: RenaissOsRateLimit = emptyRateLimit()) {
    super(message);
    this.name = "RenaissOsClientError";
    this.status = status;
    this.rateLimit = rateLimit;
  }
}

export class RenaissOsRateLimitError extends RenaissOsClientError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, rateLimit: RenaissOsRateLimit) {
    super("Renaiss OS API rate limit is active.", 429, rateLimit);
    this.name = "RenaissOsRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function emptyRateLimit(): RenaissOsRateLimit {
  return {
    limit: null,
    remaining: null,
    reset: null,
    retryAfterSeconds: null
  };
}

function intHeader(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  if (value == null || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rateLimitFromHeaders(headers: Headers): RenaissOsRateLimit {
  return {
    limit: intHeader(headers, "x-ratelimit-limit"),
    remaining: intHeader(headers, "x-ratelimit-remaining"),
    reset: intHeader(headers, "x-ratelimit-reset"),
    retryAfterSeconds: intHeader(headers, "retry-after")
  };
}

function cacheKey(input: { baseUrl: string; path: string; searchParams?: URLSearchParams }): string {
  const search = input.searchParams == null ? "" : input.searchParams.toString();
  return `renaiss-os:cache:${createHash("sha256")
    .update(`${input.baseUrl}:${input.path}?${search}`)
    .digest("hex")}`;
}

function rateLimitKey(baseUrl: string): string {
  return `renaiss-os:rate-limit:${createHash("sha256").update(baseUrl).digest("hex").slice(0, 24)}`;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function retrySecondsFromRateLimit(rateLimit: RenaissOsRateLimit): number {
  if (rateLimit.retryAfterSeconds != null && rateLimit.retryAfterSeconds > 0) {
    return Math.ceil(rateLimit.retryAfterSeconds);
  }
  if (rateLimit.reset != null) {
    return Math.max(1, rateLimit.reset - nowSeconds());
  }
  return 60;
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export class RenaissOSClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;
  private readonly env: Record<string, string | undefined>;
  private readonly fetchFn: typeof fetch;

  constructor(input: {
    env?: Record<string, string | undefined>;
    fetchFn?: typeof fetch;
  } = {}) {
    if (typeof window !== "undefined") {
      throw new Error("RenaissOSClient must only be used on the server.");
    }

    const env = RenaissOsEnvSchema.parse(input.env ?? process.env);
    this.baseUrl = env.RENAISS_OS_BASE_URL.replace(/\/+$/, "");
    this.apiKey = env.RENAISS_OS_API_KEY;
    this.apiSecret = env.RENAISS_OS_API_SECRET;
    this.env = input.env ?? process.env;
    this.fetchFn = input.fetchFn ?? fetch;
  }

  async getIndices() {
    return this.getJson("/v1/indices", RenaissOsIndicesResponseSchema, { cacheTtlSeconds: 60 });
  }

  async getIndex(game: string) {
    return this.getJson(`/v1/indices/${encodeURIComponent(game)}`, RenaissOsIndexDetailSchema, {
      cacheTtlSeconds: 120
    });
  }

  async getFeatured(limit = 12) {
    const searchParams = new URLSearchParams({ limit: String(limit) });
    return this.getJson("/v1/cards/featured", RenaissOsFeaturedResponseSchema, {
      searchParams,
      cacheTtlSeconds: 60
    });
  }

  async searchCards(query: string, limit = 24) {
    const searchParams = new URLSearchParams({ q: query, limit: String(limit) });
    return this.getJson("/v1/search", RenaissOsSearchResponseSchema, {
      searchParams,
      cacheTtlSeconds: 30
    });
  }

  async getCard(game: string, set: string, card: string) {
    return this.getJson(
      `/v1/cards/${encodeURIComponent(game)}/${encodeURIComponent(set)}/${encodeURIComponent(card)}`,
      RenaissOsCardDetailSchema,
      { cacheTtlSeconds: 300 }
    );
  }

  async getCardTrades(game: string, set: string, card: string, searchParams = new URLSearchParams()) {
    return this.getJson(
      `/v1/cards/${encodeURIComponent(game)}/${encodeURIComponent(set)}/${encodeURIComponent(card)}/trades`,
      RenaissOsTradesResponseSchema,
      { searchParams, cacheTtlSeconds: 60 }
    );
  }

  async getCardSeries(game: string, set: string, card: string, searchParams = new URLSearchParams()) {
    return this.getJson(
      `/v1/cards/${encodeURIComponent(game)}/${encodeURIComponent(set)}/${encodeURIComponent(card)}/series`,
      RenaissOsSeriesResponseSchema,
      { searchParams, cacheTtlSeconds: 120 }
    );
  }

  async getCardFmvSeries(game: string, set: string, card: string, searchParams = new URLSearchParams()) {
    return this.getJson(
      `/v1/cards/${encodeURIComponent(game)}/${encodeURIComponent(set)}/${encodeURIComponent(card)}/fmv-series`,
      RenaissOsFmvSeriesResponseSchema,
      { searchParams, cacheTtlSeconds: 120 }
    );
  }

  async getRecentTrades(limit = 12) {
    const searchParams = new URLSearchParams({ limit: String(limit) });
    return this.getJson("/v1/trades/recent", RenaissOsRecentTradesResponseSchema, {
      searchParams,
      cacheTtlSeconds: 30
    });
  }

  async getSet(game: string, set: string) {
    return this.getJson(`/v1/sets/${encodeURIComponent(game)}/${encodeURIComponent(set)}`, RenaissOsSetResponseSchema, {
      cacheTtlSeconds: 300
    });
  }

  async getGraded(cert: string) {
    return this.getJson(`/v1/graded/${encodeURIComponent(cert)}`, RenaissOsGradedLookupSchema, {
      cacheTtlSeconds: 300
    });
  }

  async getJson<Schema extends z.ZodTypeAny>(
    path: string,
    schema: Schema,
    options: {
      searchParams?: URLSearchParams;
      cacheTtlSeconds?: number;
    } = {}
  ): Promise<RenaissOsRequestResult<z.infer<Schema>>> {
    const normalizedPath = normalizePath(path);
    const cacheTtlSeconds = options.cacheTtlSeconds ?? 0;
    const key = cacheKey({
      baseUrl: this.baseUrl,
      path: normalizedPath,
      ...(options.searchParams == null ? {} : { searchParams: options.searchParams })
    });

    if (cacheTtlSeconds > 0) {
      const cached = await redisGetJson<unknown>(key, this.env);
      if (cached != null) {
        const data = schema.parse(cached) as z.infer<Schema>;
        return {
          data,
          rateLimit: emptyRateLimit(),
          cacheStatus: "hit"
        };
      }
    }

    await this.throwIfRateLimited();

    const response = await this.fetchOfficial(normalizedPath, options.searchParams);
    const rateLimit = rateLimitFromHeaders(response.headers);

    if (response.status === 429) {
      await this.rememberRateLimit(rateLimit);
      throw new RenaissOsRateLimitError(retrySecondsFromRateLimit(rateLimit), rateLimit);
    }

    if (!response.ok) {
      throw new RenaissOsClientError(`Renaiss OS API request failed with ${response.status}.`, response.status, rateLimit);
    }

    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      throw new RenaissOsClientError("Renaiss OS API response failed schema validation.", 502, rateLimit);
    }
    const data = parsed.data as z.infer<Schema>;

    if (rateLimit.remaining === 0) {
      await this.rememberRateLimit(rateLimit);
    }

    if (cacheTtlSeconds > 0) {
      await redisSetJson(key, data, cacheTtlSeconds, this.env);
    }

    return {
      data,
      rateLimit,
      cacheStatus: cacheTtlSeconds > 0 ? "miss" : "bypass"
    };
  }

  async fetchStream(path: string, searchParams?: URLSearchParams): Promise<Response> {
    await this.throwIfRateLimited();
    return this.fetchOfficial(normalizePath(path), searchParams, {
      accept: "text/event-stream"
    });
  }

  private headers(extra?: Record<string, string>): HeadersInit {
    const headers: Record<string, string> = {
      accept: "application/json",
      ...extra
    };

    if (this.apiKey != null && this.apiKey.length > 0) {
      headers["X-Api-Key"] = this.apiKey;
    }
    if (this.apiSecret != null && this.apiSecret.length > 0) {
      headers["X-Api-Secret"] = this.apiSecret;
    }

    return headers;
  }

  private async fetchOfficial(path: string, searchParams?: URLSearchParams, headers?: Record<string, string>) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of searchParams ?? new URLSearchParams()) {
      url.searchParams.append(key, value);
    }

    return this.fetchFn(url, {
      headers: this.headers(headers),
      cache: "no-store"
    });
  }

  private async throwIfRateLimited() {
    const block = await redisGetJson<{ retryAfterSeconds: number; resetAt: number }>(rateLimitKey(this.baseUrl), this.env);
    if (block == null) return;
    const retryAfterSeconds = Math.max(1, block.resetAt - nowSeconds(), block.retryAfterSeconds);
    throw new RenaissOsRateLimitError(retryAfterSeconds, {
      limit: null,
      remaining: 0,
      reset: block.resetAt,
      retryAfterSeconds
    });
  }

  private async rememberRateLimit(rateLimit: RenaissOsRateLimit) {
    const retryAfterSeconds = retrySecondsFromRateLimit(rateLimit);
    await redisSetJson(
      rateLimitKey(this.baseUrl),
      {
        retryAfterSeconds,
        resetAt: nowSeconds() + retryAfterSeconds
      },
      retryAfterSeconds,
      this.env
    );
  }
}

export function createRenaissOSClient(env?: Record<string, string | undefined>): RenaissOSClient {
  return new RenaissOSClient(env == null ? {} : { env });
}

export function headersForProxy(result: Pick<RenaissOsRequestResult<unknown>, "rateLimit" | "cacheStatus">): HeadersInit {
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    "X-Atlas-Cache": result.cacheStatus
  };

  if (result.rateLimit.limit != null) headers["X-RateLimit-Limit"] = String(result.rateLimit.limit);
  if (result.rateLimit.remaining != null) headers["X-RateLimit-Remaining"] = String(result.rateLimit.remaining);
  if (result.rateLimit.reset != null) headers["X-RateLimit-Reset"] = String(result.rateLimit.reset);
  if (result.rateLimit.retryAfterSeconds != null) headers["Retry-After"] = String(result.rateLimit.retryAfterSeconds);

  return headers;
}
