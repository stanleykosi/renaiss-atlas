import {
  createDbClient,
  DatabaseEnvSchema,
  demoPackActivities,
  packActivities
} from "@renaiss/db";

import type { DataSourceMode, FreshnessStatus } from "@/lib/market-types";
import type { PackMomentum, PackMomentumOverview, PackObservedIntervals, PackRecentPull } from "@/lib/pack-types";

const PACK_STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 2;
const NOT_OFFICIAL_ODDS_DISCLAIMER =
  "Pack intervals are observed public activity only. They are not official odds and must not be treated as probability guarantees.";

type PackActivityRow = {
  activityId: string;
  packName: string;
  packSlug: string;
  tier?: string | null;
  fmvUsd?: string | number | null;
  psaId?: string | null;
  frontImageUrl?: string | null;
  pulledAt?: Date | string | null;
  metadata?: unknown;
};

function shouldUseSeedData(): boolean {
  return process.env["DEMO_MODE"] !== "false" || process.env["DATABASE_URL"] == null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sourceLabel(sourceMode: DataSourceMode, mockData: boolean) {
  if (sourceMode === "seed") return "Seed fixtures";
  return mockData ? "Mock database seed" : "Renaiss gacha RSC";
}

function freshnessFor(latestPulledAt: string | null, now: Date): FreshnessStatus {
  if (latestPulledAt == null) return "missing";
  return now.getTime() - Date.parse(latestPulledAt) > PACK_STALE_AFTER_MS ? "stale" : "fresh";
}

function observedIntervals(pulledAtValues: string[]): PackObservedIntervals {
  const times = pulledAtValues
    .map((value) => Date.parse(value))
    .filter(Number.isFinite)
    .sort((left, right) => right - left);
  const intervals = [];

  for (let index = 0; index < times.length - 1; index += 1) {
    const current = times[index];
    const next = times[index + 1];
    if (current == null || next == null) continue;
    intervals.push(Math.max(0, Math.round((current - next) / 1000)));
  }

  const sorted = intervals.sort((left, right) => left - right);
  const medianIndex = Math.floor(sorted.length / 2);

  return {
    samples: sorted.length,
    minSeconds: sorted[0] ?? null,
    medianSeconds: sorted[medianIndex] ?? null,
    maxSeconds: sorted[sorted.length - 1] ?? null
  };
}

function tierDistribution(rows: PackActivityRow[]): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const row of rows) {
    const tier = row.tier == null || row.tier.trim().length === 0 ? "unknown" : row.tier;
    distribution[tier] = (distribution[tier] ?? 0) + 1;
  }

  return Object.fromEntries(
    Object.entries(distribution).sort(([left], [right]) =>
      left.localeCompare(right, undefined, { numeric: true })
    )
  );
}

function recentPull(row: PackActivityRow, sourceMode: DataSourceMode): PackRecentPull {
  const metadata = toRecord(row.metadata);
  const mockData = metadata["mockData"] === true || sourceMode === "seed";

  return {
    activityId: row.activityId,
    packName: row.packName,
    packSlug: row.packSlug,
    tier: row.tier ?? null,
    fmvUsd: toNumber(row.fmvUsd),
    psaId: row.psaId ?? null,
    frontImageUrl: row.frontImageUrl ?? null,
    pulledAt: toIso(row.pulledAt),
    sourceLabel: sourceLabel(sourceMode, mockData),
    mockData
  };
}

function buildPackMomentum(input: {
  rows: PackActivityRow[];
  sourceMode: DataSourceMode;
  now: Date;
  metricNow: Date;
}): PackMomentum[] {
  const byPack = new Map<string, PackActivityRow[]>();

  for (const row of input.rows) {
    const current = byPack.get(row.packSlug) ?? [];
    current.push(row);
    byPack.set(row.packSlug, current);
  }

  return [...byPack.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([packSlug, rows]) => {
      const sortedRows = [...rows].sort((left, right) => {
        const leftTime = toIso(left.pulledAt);
        const rightTime = toIso(right.pulledAt);
        return Date.parse(rightTime ?? "0") - Date.parse(leftTime ?? "0");
      });
      const latestPulledAt = toIso(sortedRows[0]?.pulledAt);
      const oneHourAgo = input.metricNow.getTime() - 1000 * 60 * 60;
      const oneDayAgo = input.metricNow.getTime() - 1000 * 60 * 60 * 24;
      const rows24h = sortedRows.filter((row) => {
        const pulledAt = toIso(row.pulledAt);
        return pulledAt != null && Date.parse(pulledAt) >= oneDayAgo;
      });
      const mockData = sortedRows.some((row) => toRecord(row.metadata)["mockData"] === true) || input.sourceMode === "seed";

      return {
        packName: sortedRows[0]?.packName ?? packSlug,
        packSlug,
        pulls1h: sortedRows.filter((row) => {
          const pulledAt = toIso(row.pulledAt);
          return pulledAt != null && Date.parse(pulledAt) >= oneHourAgo;
        }).length,
        pulls24h: rows24h.length,
        totalPulls: sortedRows.length,
        fmvPulled24h: rows24h.reduce((sum, row) => sum + (toNumber(row.fmvUsd) ?? 0), 0),
        tierDistribution: tierDistribution(sortedRows),
        observedIntervals: observedIntervals(
          sortedRows.map((row) => toIso(row.pulledAt)).filter((value): value is string => value != null)
        ),
        recentPulls: sortedRows.slice(0, 12).map((row) => recentPull(row, input.sourceMode)),
        latestPulledAt,
        freshness: freshnessFor(latestPulledAt, input.now),
        sourceLabel: sourceLabel(input.sourceMode, mockData),
        mockData
      };
    });
}

function buildOverview(input: {
  rows: PackActivityRow[];
  sourceMode: DataSourceMode;
  now: Date;
}): PackMomentumOverview {
  const latestPulledAt =
    input.rows
      .map((row) => toIso(row.pulledAt))
      .filter((value): value is string => value != null)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
  const metricNow =
    input.sourceMode === "seed" && latestPulledAt != null ? new Date(latestPulledAt) : input.now;
  const packs = buildPackMomentum({
    rows: input.rows,
    sourceMode: input.sourceMode,
    now: input.now,
    metricNow
  });

  return {
    sourceMode: input.sourceMode,
    generatedAt: input.now.toISOString(),
    packs,
    disclaimer: NOT_OFFICIAL_ODDS_DISCLAIMER,
    health: {
      totalPacks: packs.length,
      totalPulls: packs.reduce((sum, pack) => sum + pack.totalPulls, 0),
      pulls24h: packs.reduce((sum, pack) => sum + pack.pulls24h, 0),
      fmvPulled24h: packs.reduce((sum, pack) => sum + pack.fmvPulled24h, 0),
      latestPulledAt,
      stalePacks: packs.filter((pack) => pack.freshness === "stale").length,
      mockData: packs.some((pack) => pack.mockData)
    }
  };
}

async function readDbRows(): Promise<PackActivityRow[] | null> {
  const env = DatabaseEnvSchema.safeParse(process.env);
  if (!env.success) return null;

  const database = createDbClient(env.data.DATABASE_URL, {
    databaseSsl: env.data.DATABASE_SSL,
    max: 1
  });

  try {
    const rows = await database.db.select().from(packActivities);
    return rows.sort((left, right) => {
      const leftTime = toIso(left.pulledAt);
      const rightTime = toIso(right.pulledAt);
      return Date.parse(rightTime ?? "0") - Date.parse(leftTime ?? "0");
    });
  } catch {
    return null;
  } finally {
    await database.close();
  }
}

export async function getPackMomentumOverview(): Promise<PackMomentumOverview> {
  const now = new Date();

  if (shouldUseSeedData()) {
    return buildOverview({
      rows: demoPackActivities,
      sourceMode: "seed",
      now
    });
  }

  const rows = await readDbRows();
  if (rows == null || rows.length === 0) {
    return buildOverview({
      rows: demoPackActivities,
      sourceMode: "seed",
      now
    });
  }

  return buildOverview({
    rows,
    sourceMode: "database",
    now
  });
}
