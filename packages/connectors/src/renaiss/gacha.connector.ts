import { z } from "zod";

import type { Connector, ConnectorContext, ConnectorResult } from "../index.js";
import type {
  RenaissDataQualityEvent,
  RenaissGachaConfig,
  RenaissGachaInput,
  RenaissGachaPackDefinition,
  RenaissGachaPage,
  RenaissGachaSyncData
} from "./types.js";

const RSC_ACTIVITY_KEY = "openedPackActivities";

export const RENAISS_GACHA_PACKS = [
  { slug: "renacrypt-pack", name: "RenaCrypt Pack" },
  { slug: "omega", name: "OMEGA" }
] as const satisfies readonly RenaissGachaPackDefinition[];

const defaultConfig: RenaissGachaConfig = {
  baseUrl: "https://www.renaiss.xyz/gacha",
  packs: [...RENAISS_GACHA_PACKS],
  rateLimitMs: 750,
  retryAttempts: 3,
  retryBaseDelayMs: 500,
  fetch
};

const retryableStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);

const RawGachaActivitySchema = z.object({
  id: z.string().min(1),
  tier: z.union([z.string(), z.number()]).nullable().optional(),
  fmv: z.union([z.string(), z.number(), z.bigint()]).nullable().optional(),
  pulledAtTimestamp: z.union([z.number(), z.string()]).nullable().optional(),
  frontImageUrl: z.string().url().nullable().optional()
});

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(signal.reason instanceof Error ? signal.reason : new Error("Request aborted"));
      return;
    }

    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(signal.reason instanceof Error ? signal.reason : new Error("Request aborted"));
      },
      { once: true }
    );
  });
}

function mergeConfig(baseConfig: Partial<RenaissGachaConfig>, input: RenaissGachaInput): RenaissGachaConfig {
  return {
    ...defaultConfig,
    ...baseConfig,
    ...input,
    packs: input.packs ?? baseConfig.packs ?? defaultConfig.packs,
    fetch: baseConfig.fetch ?? defaultConfig.fetch,
    retryBaseDelayMs: baseConfig.retryBaseDelayMs ?? defaultConfig.retryBaseDelayMs
  };
}

function packUrl(baseUrl: string, packSlug: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(packSlug)}`;
}

async function fetchTextWithRetry(
  url: string,
  init: RequestInit,
  config: Pick<RenaissGachaConfig, "fetch" | "retryAttempts" | "retryBaseDelayMs">,
  context: Pick<ConnectorContext, "signal" | "logger">
): Promise<{ status: number; text: string }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.retryAttempts; attempt += 1) {
    try {
      const requestInit = context.signal == null ? init : { ...init, signal: context.signal };
      const response = await config.fetch(url, requestInit);

      if (!response.ok && retryableStatuses.has(response.status) && attempt < config.retryAttempts) {
        context.logger.warn({ url, status: response.status, attempt }, "Renaiss gacha RSC request returned retryable status");
        await wait(config.retryBaseDelayMs * attempt, context.signal);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Renaiss gacha RSC request failed with status ${response.status}`);
      }

      return {
        status: response.status,
        text: await response.text()
      };
    } catch (error) {
      lastError = error;
      if (attempt >= config.retryAttempts) break;

      context.logger.warn(
        {
          url,
          attempt,
          error: error instanceof Error ? error.message : String(error)
        },
        "Retrying Renaiss gacha RSC request"
      );
      await wait(config.retryBaseDelayMs * attempt, context.signal);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function extractBalancedJsonArray(text: string, key: string = RSC_ACTIVITY_KEY): string | null {
  const keyIndex = text.indexOf(`"${key}"`);
  if (keyIndex < 0) return null;

  const bracketStart = text.indexOf("[", keyIndex);
  if (bracketStart < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = bracketStart; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "[") depth += 1;
    if (character === "]") depth -= 1;

    if (depth === 0) {
      return text.slice(bracketStart, index + 1);
    }
  }

  return null;
}

export function parseRenaissFmvCents(value: unknown): string | null {
  let cents: bigint | null = null;

  if (typeof value === "bigint") {
    cents = value;
  } else if (typeof value === "number" && Number.isSafeInteger(value)) {
    cents = BigInt(value);
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    const numeric = trimmed.startsWith("$n") ? trimmed.slice(2) : trimmed;
    if (/^-?\d+$/.test(numeric)) cents = BigInt(numeric);
  }

  if (cents == null || cents < 0n) return null;

  const dollars = cents / 100n;
  const remainder = (cents % 100n).toString().padStart(2, "0");
  return `${dollars.toString()}.${remainder}`;
}

export function extractPsaIdFromImageUrl(value: string | null | undefined): string | null {
  if (value == null) return null;
  const match = /(?:^|[/-])PSA(\d+)(?:[/-]|$)/i.exec(value);
  return match?.[1] ?? null;
}

function pulledAtFromTimestamp(value: unknown): string | null {
  const timestamp =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : null;
  if (timestamp == null || !Number.isFinite(timestamp)) return null;

  const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function rawActivitiesFromRsc(text: string): unknown[] | null {
  const jsonArray = extractBalancedJsonArray(text);
  if (jsonArray == null) return null;

  const parsed: unknown = JSON.parse(jsonArray);
  return Array.isArray(parsed) ? parsed : null;
}

export function parseRenaissGachaRscActivities(input: {
  rawText: string;
  pack: RenaissGachaPackDefinition;
  fetchedAt: string;
  sourceUrl: string;
}): Pick<RenaissGachaPage, "rawActivities" | "activities" | "dataQualityEvents" | "warnings"> {
  const rawActivities = rawActivitiesFromRsc(input.rawText);
  const dataQualityEvents: RenaissDataQualityEvent[] = [];
  const warnings: string[] = [];

  if (rawActivities == null) {
    return {
      rawActivities: [],
      activities: [],
      warnings: [`${RSC_ACTIVITY_KEY} was not found in the Renaiss gacha RSC payload.`],
      dataQualityEvents: [
        {
          source: "renaiss_gacha_rsc",
          entityType: "pack",
          entityId: input.pack.slug,
          severity: "error",
          code: "gacha_opened_pack_activities_missing",
          message: "Renaiss gacha RSC payload did not include openedPackActivities.",
          details: { sourceUrl: input.sourceUrl }
        }
      ]
    };
  }

  const activities = [];
  const seenIds = new Set<string>();

  for (const rawActivity of rawActivities) {
    const parsed = RawGachaActivitySchema.safeParse(rawActivity);
    if (!parsed.success) {
      dataQualityEvents.push({
        source: "renaiss_gacha_rsc",
        entityType: "pack",
        entityId: input.pack.slug,
        severity: "warning",
        code: "gacha_activity_parse_failed",
        message: "A Renaiss gacha activity could not be parsed.",
        details: { issueCount: parsed.error.issues.length }
      });
      continue;
    }

    const activity = parsed.data;
    if (seenIds.has(activity.id)) {
      dataQualityEvents.push({
        source: "renaiss_gacha_rsc",
        entityType: "pack_activity",
        entityId: activity.id,
        severity: "info",
        code: "gacha_activity_duplicate_in_page",
        message: "Duplicate gacha activity ID was observed in one RSC payload.",
        details: { packSlug: input.pack.slug }
      });
      continue;
    }
    seenIds.add(activity.id);

    const fmvUsd = parseRenaissFmvCents(activity.fmv);
    const pulledAt = pulledAtFromTimestamp(activity.pulledAtTimestamp);
    const psaId = extractPsaIdFromImageUrl(activity.frontImageUrl);

    if (fmvUsd == null) {
      dataQualityEvents.push({
        source: "renaiss_gacha_rsc",
        entityType: "pack_activity",
        entityId: activity.id,
        severity: "warning",
        code: "gacha_fmv_parse_failed",
        message: "Gacha activity FMV could not be parsed as USD cents.",
        details: { packSlug: input.pack.slug }
      });
    }

    activities.push({
      activityId: activity.id,
      packName: input.pack.name,
      packSlug: input.pack.slug,
      tier: activity.tier == null ? null : String(activity.tier),
      fmvUsd,
      psaId,
      frontImageUrl: activity.frontImageUrl ?? null,
      pulledAt,
      firstSeenAt: input.fetchedAt,
      matchedTokenId: null,
      metadata: {
        observedIntervalNotOfficialOdds: true,
        rawFmv: activity.fmv ?? null,
        rawPulledAtTimestamp: activity.pulledAtTimestamp ?? null,
        sourceUrl: input.sourceUrl
      }
    });
  }

  if (activities.length === 0) {
    warnings.push("Renaiss gacha RSC payload contained no parseable pack activities.");
  }

  return {
    rawActivities,
    activities,
    dataQualityEvents,
    warnings
  };
}

async function fetchPackPage(
  pack: RenaissGachaPackDefinition,
  config: RenaissGachaConfig,
  context: ConnectorContext
): Promise<RenaissGachaPage> {
  const requestUrl = packUrl(config.baseUrl, pack.slug);
  const fetchedAt = context.now.toISOString();
  const { status, text } = await context.rateLimiter.schedule(() =>
    fetchTextWithRetry(
      requestUrl,
      {
        method: "GET",
        headers: {
          accept: "text/x-component",
          "next-url": `/gacha/${pack.slug}`,
          rsc: "1"
        }
      },
      config,
      context
    )
  );
  const parsed = parseRenaissGachaRscActivities({
    rawText: text,
    pack,
    fetchedAt,
    sourceUrl: requestUrl
  });

  return {
    source: "renaiss_gacha_rsc",
    sourceUrl: requestUrl,
    requestUrl,
    responseStatus: status,
    packName: pack.name,
    packSlug: pack.slug,
    fetchedAt,
    rawText: text,
    rawActivities: parsed.rawActivities,
    activities: parsed.activities,
    dataQualityEvents: parsed.dataQualityEvents,
    warnings: parsed.warnings
  };
}

function unionActivitiesById(pages: RenaissGachaPage[]) {
  const byId = new Map<string, RenaissGachaPage["activities"][number]>();
  const dataQualityEvents: RenaissDataQualityEvent[] = [];

  for (const page of pages) {
    for (const activity of page.activities) {
      const existing = byId.get(activity.activityId);
      if (existing != null) {
        dataQualityEvents.push({
          source: "renaiss_gacha_rsc",
          entityType: "pack_activity",
          entityId: activity.activityId,
          severity: "info",
          code: "gacha_activity_duplicate_across_packs",
          message: "Duplicate gacha activity ID was observed across pack fetches; first observation was kept.",
          details: {
            firstPackSlug: existing.packSlug,
            duplicatePackSlug: activity.packSlug
          }
        });
        continue;
      }

      byId.set(activity.activityId, activity);
    }
  }

  return {
    activities: [...byId.values()],
    dataQualityEvents
  };
}

export function createRenaissGachaConnector(
  baseConfig: Partial<RenaissGachaConfig> = {}
): Connector<RenaissGachaInput, RenaissGachaSyncData> {
  return {
    name: "renaiss-gacha-rsc",
    async fetch(input: RenaissGachaInput, context: ConnectorContext): Promise<ConnectorResult<RenaissGachaSyncData>> {
      const config = mergeConfig(baseConfig, input);
      const pages: RenaissGachaPage[] = [];

      for (const pack of config.packs) {
        pages.push(await fetchPackPage(pack, config, context));
      }

      const unioned = unionActivitiesById(pages);
      const data: RenaissGachaSyncData = {
        packs: config.packs,
        pages,
        activities: unioned.activities,
        dataQualityEvents: [
          ...pages.flatMap((page) => page.dataQualityEvents),
          ...unioned.dataQualityEvents
        ],
        warnings: pages.flatMap((page) => page.warnings)
      };

      return {
        source: "renaiss_gacha_rsc",
        sourceUrl: config.baseUrl,
        fetchedAt: context.now.toISOString(),
        data,
        warnings: data.warnings
      };
    }
  };
}
