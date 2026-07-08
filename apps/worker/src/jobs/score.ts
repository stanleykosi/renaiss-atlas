import path from "node:path";
import { fileURLToPath } from "node:url";

import { scoreCard, type DeterministicCardScoringInput } from "@renaiss/core";
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

import { acquireWorkerJobLock, lockedJobResult } from "../job-lock.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
loadDotEnv(repoRoot);

const startedAt = new Date();
const env = parseDatabaseEnv(process.env);
const database = createDbClient(env.DATABASE_URL, {
  databaseSsl: env.DATABASE_SSL,
  max: 2
});
const jobLock = await acquireWorkerJobLock(database.db, "score:cards");

if (!jobLock.acquired) {
  console.log(JSON.stringify(lockedJobResult(jobLock), null, 2));
  await database.close();
  process.exit(0);
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

function q3(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const index = Math.floor((sorted.length - 1) * 0.75);
  return sorted[index] ?? null;
}

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

function buildScoringInputs(rows: ScoreEvidenceRows, now: Date): DeterministicCardScoringInput[] {
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

  return rows.cards.map((card) => {
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

let syncRunId: string | undefined;

try {
  const repos = createAtlasRepositories(database.db);
  const syncRun = await repos.syncRuns.start({
    jobName: "score:cards",
    source: null,
    status: "started",
    startedAt,
    metadata: {
      algorithm: "deterministic-card-scoring-v1",
      mockData: false
    }
  });

  if (syncRun == null) throw new Error("Failed to create score sync run.");
  syncRunId = syncRun.id;

  const [cardRows, priceRows, compRows, matchRows, intentRows, bundleRows, bundleItemRows, packRows] =
    await Promise.all([
      database.db.select().from(cards),
      database.db.select().from(latestCardPrices),
      database.db.select().from(externalPriceSnapshots),
      database.db.select().from(intentMatches),
      database.db.select().from(intents),
      database.db.select().from(bundles),
      database.db.select().from(bundleItems),
      database.db.select().from(packActivities)
    ]);

  const inputs = buildScoringInputs(
    {
      cards: cardRows,
      prices: priceRows,
      externalComps: compRows,
      intentMatches: matchRows,
      intents: intentRows,
      bundles: bundleRows,
      bundleItems: bundleItemRows,
      packActivities: packRows
    },
    startedAt
  );

  let persistedScores = 0;

  for (const input of inputs) {
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

      if (saved == null) {
        throw new Error(`Failed to persist ${score.scoreType} for ${score.entityId}.`);
      }

      await repos.scores.setLatest(saved);
      persistedScores += 1;
    }
  }

  const finishedAt = new Date();
  await repos.syncRuns.finish(syncRun.id, {
    status: "success",
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    recordsSeen: inputs.length,
    recordsInserted: persistedScores,
    recordsUpdated: persistedScores,
    recordsFailed: 0,
    metadata: {
      algorithm: "deterministic-card-scoring-v1",
      cards: inputs.length,
      scores: persistedScores,
      scoreTypesPerCard: inputs.length === 0 ? 0 : persistedScores / inputs.length,
      mockData: inputs.some((input) => input.mockData === true)
    }
  });

  console.log(
    JSON.stringify(
      {
        status: "success",
        runId: syncRun.id,
        cards: inputs.length,
        scores: persistedScores
      },
      null,
      2
    )
  );
} catch (error) {
  const finishedAt = new Date();
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);

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
