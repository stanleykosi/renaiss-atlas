import type { z } from "zod";

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

type RenaissOsProxyMatch = {
  remotePath: string;
  schema: z.ZodType<object, z.ZodTypeDef, unknown>;
  cacheTtlSeconds: number;
  stream: boolean;
};

function encodeSegments(segments: readonly string[]): string {
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

export function matchRenaissOsProxyPath(segments: readonly string[]): RenaissOsProxyMatch | null {
  if (segments.some((segment) => segment.length === 0)) return null;
  const path = segments;

  if (path.length === 1 && path[0] === "indices") {
    return {
      remotePath: "/v1/indices",
      schema: RenaissOsIndicesResponseSchema,
      cacheTtlSeconds: 60,
      stream: false
    };
  }

  if (path.length === 2 && path[0] === "indices") {
    return {
      remotePath: `/v1/indices/${encodeSegments(path.slice(1))}`,
      schema: RenaissOsIndexDetailSchema,
      cacheTtlSeconds: 120,
      stream: false
    };
  }

  if (path.length === 2 && path[0] === "cards" && path[1] === "featured") {
    return {
      remotePath: "/v1/cards/featured",
      schema: RenaissOsFeaturedResponseSchema,
      cacheTtlSeconds: 60,
      stream: false
    };
  }

  if (path.length === 1 && path[0] === "search") {
    return {
      remotePath: "/v1/search",
      schema: RenaissOsSearchResponseSchema,
      cacheTtlSeconds: 30,
      stream: false
    };
  }

  if (path.length === 2 && path[0] === "trades" && path[1] === "recent") {
    return {
      remotePath: "/v1/trades/recent",
      schema: RenaissOsRecentTradesResponseSchema,
      cacheTtlSeconds: 30,
      stream: false
    };
  }

  if (path.length === 3 && path[0] === "sets") {
    return {
      remotePath: `/v1/sets/${encodeSegments(path.slice(1))}`,
      schema: RenaissOsSetResponseSchema,
      cacheTtlSeconds: 300,
      stream: false
    };
  }

  if (path.length === 2 && path[0] === "graded") {
    return {
      remotePath: `/v1/graded/${encodeSegments(path.slice(1))}`,
      schema: RenaissOsGradedLookupSchema,
      cacheTtlSeconds: 300,
      stream: false
    };
  }

  if (path.length === 3 && path[0] === "graded" && path[2] === "stream") {
    return {
      remotePath: `/v1/graded/${encodeSegments(path.slice(1, 2))}/stream`,
      schema: RenaissOsGradedLookupSchema,
      cacheTtlSeconds: 0,
      stream: true
    };
  }

  if (path.length >= 4 && path[0] === "cards") {
    const [game, set, card, child] = path.slice(1);
    if (game == null || set == null || card == null) return null;

    const base = `/v1/cards/${encodeSegments([game, set, card])}`;
    if (child == null) {
      return {
        remotePath: base,
        schema: RenaissOsCardDetailSchema,
        cacheTtlSeconds: 300,
        stream: false
      };
    }

    if (path.length !== 5) return null;
    if (child === "trades") {
      return {
        remotePath: `${base}/trades`,
        schema: RenaissOsTradesResponseSchema,
        cacheTtlSeconds: 60,
        stream: false
      };
    }
    if (child === "series") {
      return {
        remotePath: `${base}/series`,
        schema: RenaissOsSeriesResponseSchema,
        cacheTtlSeconds: 120,
        stream: false
      };
    }
    if (child === "fmv-series") {
      return {
        remotePath: `${base}/fmv-series`,
        schema: RenaissOsFmvSeriesResponseSchema,
        cacheTtlSeconds: 120,
        stream: false
      };
    }
  }

  return null;
}
