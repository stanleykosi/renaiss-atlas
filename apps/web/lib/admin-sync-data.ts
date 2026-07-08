import {
  createAtlasRepositories,
  createDbClient,
  DatabaseEnvSchema,
  type dataQualityEvents,
  type jobLocks,
  type syncRuns
} from "@renaiss/db";

import { getIntentBoard } from "@/lib/intent-data";
import { getMarketOverview, getSyncStatus } from "@/lib/market-data";
import { getPackMomentumOverview } from "@/lib/pack-data";
import { allowSeedData } from "./data-mode";

export const adminSyncJobs = [
  {
    id: "sync:renaiss:marketplace",
    label: "Renaiss marketplace",
    command: "pnpm jobs:sync:renaiss",
    cadence: "15 min"
  },
  {
    id: "sync:gacha",
    label: "Gacha packs",
    command: "pnpm jobs:sync:gacha",
    cadence: "15 min"
  },
  {
    id: "sync:external:comps",
    label: "External comps",
    command: "pnpm jobs:sync:external",
    cadence: "60 min"
  },
  {
    id: "score:cards",
    label: "Deterministic scores",
    command: "pnpm jobs:score",
    cadence: "after sync"
  },
  {
    id: "detect:bundles",
    label: "Bundle detector",
    command: "pnpm jobs:bundles",
    cadence: "after score"
  },
  {
    id: "intents",
    label: "Intent matcher",
    command: "pnpm jobs:intents",
    cadence: "after writes"
  }
] as const;

export type AdminSyncJobId = (typeof adminSyncJobs)[number]["id"];

type SyncRunRow = typeof syncRuns.$inferSelect;
type JobLockRow = typeof jobLocks.$inferSelect;
type DataQualityEventRow = typeof dataQualityEvents.$inferSelect;

export type AdminSyncWarning = {
  id: string;
  severity: string;
  code: string;
  message: string;
  source: string | null;
  entity: string | null;
  createdAt: string;
};

export type AdminSyncOverview = {
  generatedAt: string;
  mode: "seed" | "database";
  sourceLabel: string;
  health: {
    marketFreshness: string;
    totalCards: number;
    listedCards: number;
    staleCards: number;
    compMismatches: number;
    activeIntents: number;
    packPulls24h: number;
    mockData: boolean;
  };
  jobs: {
    id: AdminSyncJobId;
    label: string;
    command: string;
    cadence: string;
    status: string;
    latestRunStartedAt: string | null;
    latestRunFinishedAt: string | null;
    latestRunRecordsSeen: number;
    latestRunRecordsFailed: number;
    locked: boolean;
    lockExpiresAt: string | null;
  }[];
  warnings: AdminSyncWarning[];
};

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function warningFromRow(row: DataQualityEventRow): AdminSyncWarning {
  return {
    id: row.id,
    severity: row.severity,
    code: row.code,
    message: row.message,
    source: row.source,
    entity: row.entityType == null ? null : `${row.entityType}:${row.entityId ?? "unknown"}`,
    createdAt: row.createdAt.toISOString()
  };
}

function syntheticWarnings(input: {
  market: Awaited<ReturnType<typeof getMarketOverview>>;
  packs: Awaited<ReturnType<typeof getPackMomentumOverview>>;
}): AdminSyncWarning[] {
  const now = input.market.generatedAt;
  const warnings: AdminSyncWarning[] = [];

  if (input.market.health.mockData) {
    warnings.push({
      id: "mock-data-present",
      severity: "info",
      code: "mock_data_present",
      message: "Mock-labeled fixture rows are present; keep them labeled or remove them before judging live liquidity.",
      source: "manual_seed",
      entity: null,
      createdAt: now
    });
  }

  if (input.market.health.externalMismatchCount > 0) {
    warnings.push({
      id: "external-comp-mismatch",
      severity: "warn",
      code: "external_comp_mismatch",
      message: `${input.market.health.externalMismatchCount} card has rejected or downgraded external comp evidence.`,
      source: "external_comps",
      entity: "market",
      createdAt: now
    });
  }

  if (input.market.health.staleCards > 0) {
    warnings.push({
      id: "stale-market-data",
      severity: "warn",
      code: "stale_market_data",
      message: `${input.market.health.staleCards} cards have stale marketplace evidence.`,
      source: "renaiss_marketplace_v0",
      entity: "market",
      createdAt: now
    });
  }

  if (input.packs.health.stalePacks > 0) {
    warnings.push({
      id: "stale-pack-data",
      severity: "warn",
      code: "stale_pack_data",
      message: `${input.packs.health.stalePacks} pack feeds are stale; pack intervals remain observed only.`,
      source: "renaiss_gacha_rsc",
      entity: "packs",
      createdAt: input.packs.generatedAt
    });
  }

  return warnings;
}

async function readOperationalRows(): Promise<{
  syncRuns: SyncRunRow[];
  jobLocks: JobLockRow[];
  warnings: AdminSyncWarning[];
} | null> {
  if (allowSeedData()) return null;

  const env = DatabaseEnvSchema.safeParse(process.env);
  if (!env.success) return null;

  const database = createDbClient(env.data.DATABASE_URL, {
    databaseSsl: env.data.DATABASE_SSL,
    max: 1
  });

  try {
    const repos = createAtlasRepositories(database.db);
    const [syncRunRows, jobLockRows, warningRows] = await Promise.all([
      repos.syncRuns.latest(undefined, 40),
      repos.jobLocks.list(),
      repos.dataQualityEvents.recent(20)
    ]);

    return {
      syncRuns: syncRunRows,
      jobLocks: jobLockRows,
      warnings: warningRows.map(warningFromRow)
    };
  } catch {
    return null;
  } finally {
    await database.close();
  }
}

function jobStatus(input: {
  jobId: AdminSyncJobId;
  syncRuns: SyncRunRow[];
  jobLocks: JobLockRow[];
}) {
  const latest = input.syncRuns.find((run) => run.jobName === input.jobId);
  const lock = input.jobLocks.find((item) => item.jobName === input.jobId);

  return {
    status: lock == null ? latest?.status ?? "idle" : "locked",
    latestRunStartedAt: toIso(latest?.startedAt),
    latestRunFinishedAt: toIso(latest?.finishedAt),
    latestRunRecordsSeen: latest?.recordsSeen ?? 0,
    latestRunRecordsFailed: latest?.recordsFailed ?? 0,
    locked: lock != null,
    lockExpiresAt: toIso(lock?.expiresAt)
  };
}

export async function getAdminSyncOverview(): Promise<AdminSyncOverview> {
  const [market, syncStatus, packs, intents, operationalRows] = await Promise.all([
    getMarketOverview(),
    getSyncStatus(),
    getPackMomentumOverview(),
    getIntentBoard(),
    readOperationalRows()
  ]);
  const syncRuns = operationalRows?.syncRuns ?? [];
  const jobLocks = operationalRows?.jobLocks ?? [];
  const warnings = operationalRows?.warnings ?? syntheticWarnings({ market, packs });

  return {
    generatedAt: new Date().toISOString(),
    mode: market.sourceMode,
    sourceLabel: market.health.sourceLabel,
    health: {
      marketFreshness: syncStatus.freshness.find((item) => item.status !== "fresh")?.status ?? market.health.freshness,
      totalCards: market.health.totalCards,
      listedCards: market.health.listedCards,
      staleCards: market.health.staleCards,
      compMismatches: market.health.externalMismatchCount,
      activeIntents: intents.health.activeIntents,
      packPulls24h: packs.health.pulls24h,
      mockData: market.health.mockData || packs.health.mockData || intents.health.mockData
    },
    jobs: adminSyncJobs.map((job) => ({
      ...job,
      ...jobStatus({
        jobId: job.id,
        syncRuns,
        jobLocks
      })
    })),
    warnings
  };
}
