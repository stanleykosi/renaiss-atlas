import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createRenaissGachaConnector,
  createSerialRateLimiter,
  gachaConfigFromEnv,
  parseRenaissGachaEnv,
  persistRenaissGachaSync
} from "@renaiss/connectors";
import {
  createAtlasRepositories,
  createDbClient,
  loadDotEnv,
  parseDatabaseEnv
} from "@renaiss/db";
import pino from "pino";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
loadDotEnv(repoRoot);

const logger = pino({
  name: "renaiss-gacha-sync-worker",
  level: process.env["LOG_LEVEL"] ?? "info"
});

const startedAt = new Date();
const databaseEnv = parseDatabaseEnv(process.env);
const gachaEnv = parseRenaissGachaEnv(process.env);
const gachaConfig = gachaConfigFromEnv(gachaEnv);
const database = createDbClient(databaseEnv.DATABASE_URL, {
  databaseSsl: databaseEnv.DATABASE_SSL,
  max: 2
});

let syncRunId: string | undefined;

try {
  if (!gachaEnv.GACHA_SYNC_ENABLED) {
    console.log(
      JSON.stringify(
        {
          status: "skipped",
          reason: "GACHA_SYNC_ENABLED=false"
        },
        null,
        2
      )
    );
    await database.close();
    process.exit(0);
  }

  const repos = createAtlasRepositories(database.db);
  const syncRun = await repos.syncRuns.start({
    jobName: "sync:gacha",
    source: "renaiss_gacha_rsc",
    status: "started",
    startedAt,
    metadata: {
      packs: gachaConfig.packs.map((pack) => pack.slug),
      baseUrl: gachaConfig.baseUrl,
      mockData: false,
      observedIntervalNotOfficialOdds: true
    }
  });

  if (syncRun == null) {
    throw new Error("Failed to create Renaiss gacha sync run.");
  }

  syncRunId = syncRun.id;

  const connector = createRenaissGachaConnector(gachaConfig);
  const result = await connector.fetch(
    {
      baseUrl: gachaConfig.baseUrl,
      packs: gachaConfig.packs,
      rateLimitMs: gachaConfig.rateLimitMs,
      retryAttempts: gachaConfig.retryAttempts
    },
    {
      runId: syncRun.id,
      now: startedAt,
      logger,
      rateLimiter: createSerialRateLimiter(gachaConfig.rateLimitMs)
    }
  );

  const persisted = await persistRenaissGachaSync(database.db, result.data, {
    syncRunId: syncRun.id
  });
  const finishedAt = new Date();
  const errorEvents = result.data.dataQualityEvents.filter((event) => event.severity === "error");
  const status = errorEvents.length > 0 ? "partial" : "success";
  const recordsSeen = result.data.pages.reduce((total, page) => total + page.rawActivities.length, 0);

  await repos.syncRuns.finish(syncRun.id, {
    status,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    recordsSeen,
    recordsInserted: persisted.sourceRecords + persisted.packActivities,
    recordsUpdated: persisted.packActivities,
    recordsFailed: errorEvents.length,
    metadata: {
      packs: result.data.packs.map((pack) => pack.slug),
      pages: result.data.pages.length,
      warnings: result.warnings,
      persisted,
      observedIntervalNotOfficialOdds: true,
      mockData: false
    }
  });

  console.log(
    JSON.stringify(
      {
        status,
        runId: syncRun.id,
        source: result.source,
        packs: result.data.packs.map((pack) => pack.slug),
        pages: result.data.pages.length,
        recordsSeen,
        activities: result.data.activities.length,
        dataQualityEvents: result.data.dataQualityEvents.length,
        persisted
      },
      null,
      2
    )
  );
} catch (error) {
  const finishedAt = new Date();
  const message = error instanceof Error ? error.message : String(error);
  logger.error({ error: message }, "Renaiss gacha sync failed");

  if (syncRunId != null) {
    const repos = createAtlasRepositories(database.db);
    await repos.syncRuns.finish(syncRunId, {
      status: "failed",
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      recordsFailed: 1,
      errorMessage: message
    });
  }

  process.exitCode = 1;
} finally {
  await database.close();
}
