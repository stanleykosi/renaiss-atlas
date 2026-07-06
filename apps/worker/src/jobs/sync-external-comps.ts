import path from "node:path";
import { fileURLToPath } from "node:url";

import { scoreCard, type DeterministicCardScoringInput } from "@renaiss/core";
import {
  buildExternalCompQueue,
  createExchangeRateConnector,
  createPriceChartingConnector,
  createSerialRateLimiter,
  createSnkrdunkConnector,
  externalCompConfigFromEnv,
  parseExternalCompEnv,
  persistExternalCompSync,
  type ExternalCompCardInput,
  type ExternalCompSourcePlatform
} from "@renaiss/connectors";
import {
  bundleItems,
  bundles,
  cards,
  createAtlasRepositories,
  createDbClient,
  externalPriceSnapshots,
  intentMatches,
  intents,
  latestCardPrices,
  loadDotEnv,
  packActivities,
  parseDatabaseEnv
} from "@renaiss/db";
import pino from "pino";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
loadDotEnv(repoRoot);

const logger = pino({
  name: "external-comp-sync-worker",
  level: process.env["LOG_LEVEL"] ?? "info"
});

const startedAt = new Date();
const databaseEnv = parseDatabaseEnv(process.env);
const externalEnv = parseExternalCompEnv(process.env);
const externalConfig = externalCompConfigFromEnv(externalEnv);
const database = createDbClient(databaseEnv.DATABASE_URL, {
  databaseSsl: databaseEnv.DATABASE_SSL,
  max: 2
});

type ScoreEvidenceRows = {
  cards: (typeof cards.$inferSelect)[];
  prices: (typeof latestCardPrices.$inferSelect)[];
  externalComps: (typeof externalPriceSnapshots.$inferSelect)[];
  intentMatches: (typeof intentMatches.$inferSelect)[];
  intents: (typeof intents.$inferSelect)[];
  bundles: (typeof bundles.$inferSelect)[];
  bundleItems: (typeof bundleItems.$inferSelect)[];
  packActivities: (typeof packActivities.$inferSelect)[];
};

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

function q3(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const index = Math.floor((sorted.length - 1) * 0.75);
  return sorted[index] ?? null;
}

function externalCardInput(
  card: typeof cards.$inferSelect,
  price: typeof latestCardPrices.$inferSelect | undefined
): ExternalCompCardInput {
  return {
    tokenId: card.tokenId,
    name: card.name,
    setName: card.setName,
    cardNumber: card.cardNumber,
    characterName: card.characterName,
    tcg: card.tcg,
    grader: card.grader,
    grade: card.grade,
    language: card.language,
    year: card.year,
    fmvUsd: toNumber(price?.fmvUsd),
    askPriceUsd: toNumber(price?.askPriceUsd)
  };
}

function buildScoringInputs(
  rows: ScoreEvidenceRows,
  now: Date,
  affectedTokenIds: Set<string>
): DeterministicCardScoringInput[] {
  const priceByToken = new Map(rows.prices.map((price) => [price.tokenId, price]));
  const compsByToken = new Map<string, (typeof externalPriceSnapshots.$inferSelect)[]>();
  const activeIntentIds = new Set(
    rows.intents.filter((intent) => intent.status === "active").map((intent) => intent.id)
  );
  const intentMatchesByToken = new Map<string, (typeof intentMatches.$inferSelect)[]>();
  const bundleById = new Map(rows.bundles.map((bundle) => [bundle.id, bundle]));
  const bundleTypesByToken = new Map<string, Set<string>>();
  const packOriginTokens = new Set(
    rows.packActivities
      .map((activity) => activity.matchedTokenId)
      .filter((tokenId): tokenId is string => tokenId != null && tokenId.length > 0)
  );

  for (const comp of rows.externalComps) {
    const current = compsByToken.get(comp.tokenId) ?? [];
    current.push(comp);
    compsByToken.set(comp.tokenId, current);
  }

  for (const match of rows.intentMatches) {
    if (!activeIntentIds.has(match.intentId)) continue;
    const current = intentMatchesByToken.get(match.tokenId) ?? [];
    current.push(match);
    intentMatchesByToken.set(match.tokenId, current);
  }

  for (const item of rows.bundleItems) {
    const bundle = bundleById.get(item.bundleId);
    if (bundle == null) continue;
    const current = bundleTypesByToken.get(item.tokenId) ?? new Set<string>();
    current.add(bundle.bundleType);
    bundleTypesByToken.set(item.tokenId, current);
  }

  const highFmvThreshold = q3(rows.prices.map((price) => toNumber(price.fmvUsd) ?? 0));

  return rows.cards
    .filter((card) => affectedTokenIds.has(card.tokenId))
    .map((card) => {
      const price = priceByToken.get(card.tokenId);
      const metadata = toRecord(card.metadata);
      const bundleTypes = bundleTypesByToken.get(card.tokenId) ?? new Set<string>();
      const fmvUsd = toNumber(price?.fmvUsd);
      const observedAt = price?.observedAt ?? card.lastSeenAt;

      return {
        tokenId: card.tokenId,
        status: card.status,
        askPriceUsd: toNumber(price?.askPriceUsd),
        fmvUsd,
        offerPriceUsd: toNumber(price?.offerPriceUsd),
        topOfferUsd: toNumber(price?.topOfferUsd),
        lastSaleUsd: toNumber(price?.lastSaleUsd),
        buybackBaseValueUsd: toNumber(price?.buybackBaseValueUsd),
        observedAt,
        lastSaleAt: price?.lastSaleUsd == null ? null : observedAt,
        askChangedAt: observedAt,
        externalComps: (compsByToken.get(card.tokenId) ?? []).map((comp) => ({
          priceUsd: toNumber(comp.currentPriceUsd),
          averagePriceUsd: toNumber(comp.averagePriceUsd),
          matchConfidence: toNumber(comp.matchConfidence),
          rejected: comp.rejected,
          fetchedAt: comp.fetchedAt
        })),
        intentMatches: (intentMatchesByToken.get(card.tokenId) ?? []).map((match) => ({
          matchScore: toNumber(match.matchScore) ?? 0,
          createdAt: match.createdAt
        })),
        adjacentCertExists: bundleTypes.has("sequential_cert_pair"),
        sameCharacterBundleExists: bundleTypes.has("same_character"),
        sameSetBundleExists: bundleTypes.has("same_set"),
        packOriginStory: packOriginTokens.has(card.tokenId),
        highFmvPercentile: highFmvThreshold == null ? false : fmvUsd != null && fmvUsd >= highFmvThreshold,
        grade: card.grade,
        mockData: metadata["mockData"] === true,
        now
      };
    });
}

function createSourceConnector(platform: ExternalCompSourcePlatform) {
  if (platform === "snkrdunk") {
    return createSnkrdunkConnector({
      liveEnabled: externalConfig.liveEnabled,
      baseUrl: externalConfig.snkrdunkBaseUrl,
      jinaReaderBaseUrl: externalConfig.jinaReaderBaseUrl,
      rateLimitMs: externalConfig.rateLimitMs,
      retryAttempts: externalConfig.retryAttempts
    });
  }

  return createPriceChartingConnector({
    liveEnabled: externalConfig.liveEnabled,
    baseUrl: externalConfig.priceChartingBaseUrl,
    jinaReaderBaseUrl: externalConfig.jinaReaderBaseUrl,
    priceChartingApiUrl: externalConfig.priceChartingApiUrl,
    priceChartingApiToken: externalConfig.priceChartingApiToken,
    rateLimitMs: externalConfig.rateLimitMs,
    retryAttempts: externalConfig.retryAttempts
  });
}

let syncRunId: string | undefined;

try {
  const repos = createAtlasRepositories(database.db);

  if (!externalConfig.enabled) {
    logger.info({ enabled: false }, "External comp sync disabled");
    await database.close();
    process.exit(0);
  }

  const syncRun = await repos.syncRuns.start({
    jobName: "sync:external:comps",
    source: null,
    status: "started",
    startedAt,
    metadata: {
      live: externalConfig.liveEnabled,
      sources: externalConfig.sources,
      batchSize: externalConfig.batchSize,
      staleDays: externalConfig.staleDays
    }
  });

  if (syncRun == null) throw new Error("Failed to create external comp sync run.");
  syncRunId = syncRun.id;

  const [cardRows, priceRows, compRows] = await Promise.all([
    database.db.select().from(cards),
    database.db.select().from(latestCardPrices),
    database.db.select().from(externalPriceSnapshots)
  ]);
  const priceByToken = new Map(priceRows.map((price) => [price.tokenId, price]));
  const queue = buildExternalCompQueue({
    cards: cardRows.map((card) => externalCardInput(card, priceByToken.get(card.tokenId))),
    existingComps: compRows.map((comp) => ({
      tokenId: comp.tokenId,
      platform: comp.platform as ExternalCompSourcePlatform,
      fetchedAt: comp.fetchedAt
    })),
    sources: externalConfig.sources,
    now: startedAt,
    staleAfterDays: externalConfig.staleDays,
    limit: externalConfig.batchSize
  });

  const exchangeConnector = createExchangeRateConnector({
    liveEnabled: externalConfig.exchangeRatesLiveEnabled,
    url: externalConfig.exchangeRatesUrl
  });
  const exchangeResult = await exchangeConnector.fetch(
    {},
    {
      runId: syncRun.id,
      now: startedAt,
      logger,
      rateLimiter: createSerialRateLimiter(externalConfig.rateLimitMs)
    }
  );

  let sourceRecords = 0;
  let externalPriceRows = 0;
  let dataQualityEvents = 0;
  const affectedTokenIds = new Set(queue.map((item) => item.card.tokenId));
  const warnings: string[] = [...exchangeResult.warnings];

  for (const source of externalConfig.sources) {
    const sourceCards = queue
      .filter((item) => item.duePlatforms.includes(source))
      .map((item) => item.card);
    if (sourceCards.length === 0) continue;

    const connector = createSourceConnector(source);
    const result = await connector.fetch(
      { cards: sourceCards, exchangeRates: exchangeResult.data },
      {
        runId: syncRun.id,
        now: startedAt,
        logger,
        rateLimiter: createSerialRateLimiter(externalConfig.rateLimitMs)
      }
    );
    const persisted = await persistExternalCompSync(database.db, result.data, {
      syncRunId: syncRun.id
    });

    sourceRecords += persisted.sourceRecords;
    externalPriceRows += persisted.externalPriceSnapshots;
    dataQualityEvents += persisted.dataQualityEvents;
    warnings.push(...result.warnings);
  }

  const scoreRows = await Promise.all([
    database.db.select().from(cards),
    database.db.select().from(latestCardPrices),
    database.db.select().from(externalPriceSnapshots),
    database.db.select().from(intentMatches),
    database.db.select().from(intents),
    database.db.select().from(bundles),
    database.db.select().from(bundleItems),
    database.db.select().from(packActivities)
  ]);
  const scoringInputs = buildScoringInputs(
    {
      cards: scoreRows[0],
      prices: scoreRows[1],
      externalComps: scoreRows[2],
      intentMatches: scoreRows[3],
      intents: scoreRows[4],
      bundles: scoreRows[5],
      bundleItems: scoreRows[6],
      packActivities: scoreRows[7]
    },
    startedAt,
    affectedTokenIds
  );

  let persistedScores = 0;
  for (const input of scoringInputs) {
    const scoreSet = scoreCard(input);
    for (const score of Object.values(scoreSet.scores)) {
      const saved = await repos.scores.create({
        entityType: score.entityType,
        entityId: score.entityId,
        scoreType: score.scoreType,
        scoreValue: score.value.toFixed(2),
        confidence: score.confidence,
        inputsHash: score.inputsHash,
        reasonsJson: score.reasons,
        riskFlagsJson: score.riskFlags,
        computedAt: new Date(score.computedAt)
      });

      if (saved == null) throw new Error(`Failed to persist ${score.scoreType} for ${score.entityId}.`);
      await repos.scores.setLatest(saved);
      persistedScores += 1;
    }
  }

  const finishedAt = new Date();
  await repos.syncRuns.finish(syncRun.id, {
    status: dataQualityEvents > 0 ? "partial" : "success",
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    recordsSeen: queue.length,
    recordsInserted: sourceRecords + externalPriceRows + persistedScores,
    recordsUpdated: persistedScores,
    recordsFailed: dataQualityEvents,
    metadata: {
      live: externalConfig.liveEnabled,
      exchangeRates: exchangeResult.data.live ? "live" : "fixture",
      queued: queue.length,
      sourceRecords,
      externalPriceSnapshots: externalPriceRows,
      scores: persistedScores,
      warnings
    }
  });

  console.log(
    JSON.stringify(
      {
        status: dataQualityEvents > 0 ? "partial" : "success",
        runId: syncRun.id,
        queued: queue.length,
        sourceRecords,
        externalPriceSnapshots: externalPriceRows,
        scores: persistedScores,
        live: externalConfig.liveEnabled
      },
      null,
      2
    )
  );
} catch (error) {
  const finishedAt = new Date();
  const message = error instanceof Error ? error.message : String(error);
  logger.error({ error: message }, "External comp sync failed");

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
