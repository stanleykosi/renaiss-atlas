import { z } from "zod";

import type { Connector, ConnectorContext, ConnectorResult } from "../index.js";
import { fetchJsonWithRetry } from "./http.js";
import { normalizeRenaissMarketplaceItem, strategyToSource } from "./normalize.js";
import type {
  RenaissConcreteMarketplaceStrategy,
  RenaissMarketplaceConfig,
  RenaissMarketplaceInput,
  RenaissMarketplacePage,
  RenaissMarketplaceSyncData
} from "./types.js";

type UnknownRecord = Record<string, unknown>;

const RawMarketplaceResponseSchema = z.union([z.array(z.unknown()), z.record(z.unknown())]);

const itemContainerKeys = ["items", "collectibles", "results", "data"] as const;

const defaultConfig: RenaissMarketplaceConfig = {
  strategy: "auto",
  v0Url: "https://api.renaiss.xyz/v0/marketplace",
  trpcUrl: "https://www.renaiss.xyz/api/trpc/collectible.list",
  pageSize: 50,
  maxPages: 100,
  listedOnly: true,
  rateLimitMs: 750,
  retryAttempts: 3,
  retryBaseDelayMs: 500,
  fetch: fetch
};

function isRecord(value: unknown): value is UnknownRecord {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function getPath(record: UnknownRecord, path: readonly string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function collectCandidateRecords(raw: unknown): UnknownRecord[] {
  const candidates: UnknownRecord[] = [];

  const add = (value: unknown) => {
    if (isRecord(value)) candidates.push(value);
  };

  if (isUnknownArray(raw)) {
    const first = raw[0];
    if (isRecord(first) && ("result" in first || ("data" in first && !("tokenId" in first)))) {
      add(first);
      add(getPath(first, ["result"]));
      add(getPath(first, ["result", "data"]));
      add(getPath(first, ["result", "data", "json"]));
      add(getPath(first, ["data"]));
      add(getPath(first, ["data", "json"]));
      return candidates;
    }
  }

  add(raw);
  if (isRecord(raw)) {
    add(getPath(raw, ["data"]));
    add(getPath(raw, ["data", "json"]));
    add(getPath(raw, ["result"]));
    add(getPath(raw, ["result", "data"]));
    add(getPath(raw, ["result", "data", "json"]));
  }

  return candidates;
}

function looksLikeItemArray(raw: unknown): raw is unknown[] {
  if (!isUnknownArray(raw)) return false;
  if (raw.length === 0) return true;
  const first = raw[0];
  return isRecord(first) && ("tokenId" in first || "itemId" in first || "name" in first || "title" in first);
}

function extractItems(raw: unknown): { items: unknown[]; envelope: UnknownRecord | null } {
  if (looksLikeItemArray(raw)) {
    return { items: raw, envelope: null };
  }

  for (const candidate of collectCandidateRecords(raw)) {
    for (const key of itemContainerKeys) {
      const value = candidate[key];
      if (Array.isArray(value)) {
        return { items: value, envelope: candidate };
      }
    }
  }

  return { items: [], envelope: isRecord(raw) ? raw : null };
}

function readPagination(
  envelope: UnknownRecord | null,
  itemCount: number,
  offset: number,
  limit: number
): { hasMore: boolean; nextOffset: number } {
  const nextOffset =
    asNumber(envelope?.["nextOffset"]) ??
    asNumber(envelope?.["next_offset"]) ??
    asNumber(envelope == null ? undefined : getPath(envelope, ["cursor", "nextOffset"])) ??
    offset + itemCount;
  const hasMore =
    asBoolean(envelope?.["hasMore"]) ??
    asBoolean(envelope?.["has_more"]) ??
    asBoolean(envelope == null ? undefined : getPath(envelope, ["pagination", "hasMore"]));
  const total =
    asNumber(envelope?.["total"]) ??
    asNumber(envelope?.["totalCount"]) ??
    asNumber(envelope?.["count"]) ??
    asNumber(envelope == null ? undefined : getPath(envelope, ["pagination", "total"]));

  if (hasMore != null) return { hasMore, nextOffset };
  if (total != null) return { hasMore: offset + itemCount < total, nextOffset };

  return { hasMore: itemCount >= limit, nextOffset };
}

function buildV0Url(baseUrl: string, offset: number, limit: number, listedOnly: boolean): string {
  const url = new URL(baseUrl);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("sortBy", "listDate");
  url.searchParams.set("sortOrder", "desc");
  url.searchParams.set("listedOnly", String(listedOnly));
  return url.toString();
}

function buildTrpcUrl(baseUrl: string, offset: number, limit: number, listedOnly: boolean): string {
  const url = new URL(baseUrl);
  url.searchParams.set(
    "input",
    JSON.stringify({
      json: {
        limit,
        offset,
        sortBy: "listDate",
        sortOrder: "desc",
        listedOnly,
        characterFilter: "",
        languageFilter: "",
        gradingCompanyFilter: "",
        gradeFilter: "",
        yearRange: "",
        priceRangeFilter: ""
      }
    })
  );
  return url.toString();
}

function mergeConfig(
  baseConfig: Partial<RenaissMarketplaceConfig>,
  input: RenaissMarketplaceInput
): RenaissMarketplaceConfig {
  return {
    ...defaultConfig,
    ...baseConfig,
    ...input,
    fetch: baseConfig.fetch ?? defaultConfig.fetch,
    retryBaseDelayMs: baseConfig.retryBaseDelayMs ?? defaultConfig.retryBaseDelayMs
  };
}

function concreteStrategyUrl(
  strategy: RenaissConcreteMarketplaceStrategy,
  config: RenaissMarketplaceConfig,
  offset: number
): string {
  return strategy === "v0"
    ? buildV0Url(config.v0Url, offset, config.pageSize, config.listedOnly)
    : buildTrpcUrl(config.trpcUrl, offset, config.pageSize, config.listedOnly);
}

async function fetchPage(
  strategy: RenaissConcreteMarketplaceStrategy,
  offset: number,
  config: RenaissMarketplaceConfig,
  context: ConnectorContext
): Promise<RenaissMarketplacePage> {
  const requestUrl = concreteStrategyUrl(strategy, config, offset);
  const fetchedAt = context.now.toISOString();
  const { status, json } = await context.rateLimiter.schedule(() =>
    fetchJsonWithRetry(
      requestUrl,
      {
        method: "GET",
        headers: {
          accept: "application/json"
        }
      },
      config,
      context
    )
  );

  const raw = RawMarketplaceResponseSchema.parse(json);
  const { items, envelope } = extractItems(raw);
  const { hasMore, nextOffset } = readPagination(envelope, items.length, offset, config.pageSize);
  const cards = [];
  const prices = [];
  const dataQualityEvents = [];
  const warnings = [];

  for (const item of items) {
    const normalized = normalizeRenaissMarketplaceItem(item, {
      strategy,
      observedAt: fetchedAt,
      sourceUrl: requestUrl
    });

    if (normalized.card != null) cards.push(normalized.card);
    if (normalized.price != null) prices.push(normalized.price);
    dataQualityEvents.push(...normalized.dataQualityEvents);
    warnings.push(...normalized.warnings);
  }

  if (items.length === 0) {
    warnings.push("Renaiss marketplace page contained no items.");
  }

  return {
    strategy,
    source: strategyToSource(strategy),
    sourceUrl: strategy === "v0" ? config.v0Url : config.trpcUrl,
    requestUrl,
    responseStatus: status,
    offset,
    limit: config.pageSize,
    fetchedAt,
    raw,
    rawItems: items,
    cards,
    prices,
    dataQualityEvents,
    warnings,
    hasMore,
    nextOffset
  };
}

async function fetchConcreteStrategy(
  strategy: RenaissConcreteMarketplaceStrategy,
  config: RenaissMarketplaceConfig,
  context: ConnectorContext
): Promise<RenaissMarketplaceSyncData> {
  const pages: RenaissMarketplacePage[] = [];
  let offset = 0;

  for (let pageIndex = 0; pageIndex < config.maxPages; pageIndex += 1) {
    const page = await fetchPage(strategy, offset, config, context);
    pages.push(page);

    if (!page.hasMore || page.rawItems.length === 0) break;
    offset = page.nextOffset;
  }

  return {
    strategy,
    pages,
    cards: pages.flatMap((page) => page.cards),
    prices: pages.flatMap((page) => page.prices),
    dataQualityEvents: pages.flatMap((page) => page.dataQualityEvents),
    warnings: pages.flatMap((page) => page.warnings)
  };
}

export function createRenaissMarketplaceConnector(
  baseConfig: Partial<RenaissMarketplaceConfig> = {}
): Connector<RenaissMarketplaceInput, RenaissMarketplaceSyncData> {
  return {
    name: "renaiss-marketplace",
    async fetch(
      input: RenaissMarketplaceInput,
      context: ConnectorContext
    ): Promise<ConnectorResult<RenaissMarketplaceSyncData>> {
      const config = mergeConfig(baseConfig, input);
      const strategy = config.strategy;

      if (strategy === "auto") {
        try {
          const data = await fetchConcreteStrategy("v0", config, context);
          return {
            source: strategyToSource(data.strategy),
            sourceUrl: config.v0Url,
            fetchedAt: context.now.toISOString(),
            data,
            warnings: data.warnings
          };
        } catch (error) {
          context.logger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            "Renaiss v0 marketplace strategy failed; falling back to tRPC"
          );
          const data = await fetchConcreteStrategy("trpc", config, context);
          return {
            source: strategyToSource(data.strategy),
            sourceUrl: config.trpcUrl,
            fetchedAt: context.now.toISOString(),
            data,
            warnings: [
              "Renaiss v0 marketplace strategy failed; used tRPC fallback.",
              ...data.warnings
            ]
          };
        }
      }

      const data = await fetchConcreteStrategy(strategy, config, context);
      return {
        source: strategyToSource(data.strategy),
        sourceUrl: strategy === "v0" ? config.v0Url : config.trpcUrl,
        fetchedAt: context.now.toISOString(),
        data,
        warnings: data.warnings
      };
    }
  };
}
