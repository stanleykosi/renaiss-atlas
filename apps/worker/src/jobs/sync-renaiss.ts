import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createRenaissMarketplaceConnector,
  createSerialRateLimiter,
  marketplaceConfigFromEnv,
  parseRenaissMarketplaceEnv,
  persistRenaissMarketplaceSync,
  strategyToSource
} from "@renaiss/connectors";
import {
  createAtlasRepositories,
  createDbClient,
  loadDotEnv,
  parseDatabaseEnv
} from "@renaiss/db";
import pino from "pino";

import { acquireWorkerJobLock, lockedJobResult } from "../job-lock.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
loadDotEnv(repoRoot);

const logger = pino({
  name: "renaiss-sync-worker",
  level: process.env["LOG_LEVEL"] ?? "info"
});

const startedAt = new Date();
const databaseEnv = parseDatabaseEnv(process.env);
const marketplaceEnv = parseRenaissMarketplaceEnv(process.env);
const marketplaceConfig = marketplaceConfigFromEnv(marketplaceEnv);
const database = createDbClient(databaseEnv.DATABASE_URL, {
  databaseSsl: databaseEnv.DATABASE_SSL,
  max: 2
});
const jobLock = await acquireWorkerJobLock(database.db, "sync:renaiss:marketplace");

if (!jobLock.acquired) {
  console.log(JSON.stringify(lockedJobResult(jobLock), null, 2));
  await database.close();
  process.exit(0);
}

let syncRunId: string | undefined;

try {
  const repos = createAtlasRepositories(database.db);
  const requestedSource =
    marketplaceConfig.strategy === "trpc" ? strategyToSource("trpc") : strategyToSource("v0");
  const syncRun = await repos.syncRuns.start({
    jobName: "sync:renaiss:marketplace",
    source: requestedSource,
    status: "started",
    startedAt,
    metadata: {
      strategy: marketplaceConfig.strategy,
      pageSize: marketplaceConfig.pageSize,
      maxPages: marketplaceConfig.maxPages,
      listedOnly: marketplaceConfig.listedOnly,
      mockData: false
    }
  });

  if (syncRun == null) {
    throw new Error("Failed to create Renaiss marketplace sync run.");
  }

  syncRunId = syncRun.id;

  const connector = createRenaissMarketplaceConnector(marketplaceConfig);
  const result = await connector.fetch(
    {
      strategy: marketplaceConfig.strategy,
      pageSize: marketplaceConfig.pageSize,
      maxPages: marketplaceConfig.maxPages,
      listedOnly: marketplaceConfig.listedOnly,
      rateLimitMs: marketplaceConfig.rateLimitMs,
      retryAttempts: marketplaceConfig.retryAttempts
    },
    {
      runId: syncRun.id,
      now: startedAt,
      logger,
      rateLimiter: createSerialRateLimiter(marketplaceConfig.rateLimitMs)
    }
  );

  const persisted = await persistRenaissMarketplaceSync(database.db, result.data, {
    syncRunId: syncRun.id
  });
  const finishedAt = new Date();
  const errorEvents = result.data.dataQualityEvents.filter((event) => event.severity === "error");
  const status = errorEvents.length > 0 ? "partial" : "success";
  const recordsSeen = result.data.pages.reduce((total, page) => total + page.rawItems.length, 0);

  await repos.syncRuns.finish(syncRun.id, {
    status,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    recordsSeen,
    recordsInserted: persisted.sourceRecords + persisted.cards + persisted.priceSnapshots,
    recordsUpdated: persisted.latestPrices,
    recordsFailed: errorEvents.length,
    metadata: {
      strategy: result.data.strategy,
      pages: result.data.pages.length,
      warnings: result.warnings,
      persisted,
      mockData: false
    }
  });

  console.log(
    JSON.stringify(
      {
        status,
        runId: syncRun.id,
        source: result.source,
        pages: result.data.pages.length,
        recordsSeen,
        cards: result.data.cards.length,
        prices: result.data.prices.length,
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
  logger.error({ error: message }, "Renaiss marketplace sync failed");

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
  await jobLock.release();
  await database.close();
}
