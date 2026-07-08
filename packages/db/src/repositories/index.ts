import type { AtlasDb } from "../client.js";
import { createActionsRepo } from "./actions.repo.js";
import { createAiMemosRepo } from "./ai-memos.repo.js";
import { createBundlesRepo } from "./bundles.repo.js";
import { createCardsRepo } from "./cards.repo.js";
import { createDataQualityEventsRepo } from "./data-quality-events.repo.js";
import { createDiscordEventsRepo } from "./discord-events.repo.js";
import { createExternalPricesRepo } from "./external-prices.repo.js";
import { createIntentsRepo } from "./intents.repo.js";
import { createJobLocksRepo } from "./job-locks.repo.js";
import { createPackActivitiesRepo } from "./pack-activities.repo.js";
import { createPriceSnapshotsRepo } from "./price-snapshots.repo.js";
import { createScoresRepo } from "./scores.repo.js";
import { createSourceRecordsRepo } from "./source-records.repo.js";
import { createSyncRunsRepo } from "./sync-runs.repo.js";

export function createAtlasRepositories(db: AtlasDb) {
  return {
    actions: createActionsRepo(db),
    aiMemos: createAiMemosRepo(db),
    bundles: createBundlesRepo(db),
    cards: createCardsRepo(db),
    dataQualityEvents: createDataQualityEventsRepo(db),
    discordEvents: createDiscordEventsRepo(db),
    externalPrices: createExternalPricesRepo(db),
    intents: createIntentsRepo(db),
    jobLocks: createJobLocksRepo(db),
    packActivities: createPackActivitiesRepo(db),
    priceSnapshots: createPriceSnapshotsRepo(db),
    scores: createScoresRepo(db),
    sourceRecords: createSourceRecordsRepo(db),
    syncRuns: createSyncRunsRepo(db)
  };
}

export * from "./actions.repo.js";
export * from "./ai-memos.repo.js";
export * from "./bundles.repo.js";
export * from "./cards.repo.js";
export * from "./data-quality-events.repo.js";
export * from "./discord-events.repo.js";
export * from "./external-prices.repo.js";
export * from "./intents.repo.js";
export * from "./job-locks.repo.js";
export * from "./pack-activities.repo.js";
export * from "./price-snapshots.repo.js";
export * from "./scores.repo.js";
export * from "./source-records.repo.js";
export * from "./sync-runs.repo.js";
