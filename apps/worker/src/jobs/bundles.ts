import path from "node:path";
import { fileURLToPath } from "node:url";

import { detectBundles, type BundleDetectionCardInput } from "@renaiss/core";
import {
  cards,
  createAtlasRepositories,
  createDbClient,
  intentMatches,
  intents,
  latestCardPrices,
  loadDotEnv,
  parseDatabaseEnv
} from "@renaiss/db";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
loadDotEnv(repoRoot);

const startedAt = new Date();
const env = parseDatabaseEnv(process.env);
const database = createDbClient(env.DATABASE_URL, {
  databaseSsl: env.DATABASE_SSL,
  max: 2
});

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

let syncRunId: string | undefined;

try {
  const repos = createAtlasRepositories(database.db);
  const syncRun = await repos.syncRuns.start({
    jobName: "detect:bundles",
    source: null,
    status: "started",
    startedAt,
    metadata: {
      algorithm: "deterministic_bundle_detector_v1",
      mockData: false
    }
  });

  if (syncRun == null) throw new Error("Failed to create bundle detection sync run.");
  syncRunId = syncRun.id;

  const [cardRows, priceRows, intentRows, intentMatchRows] = await Promise.all([
    database.db.select().from(cards),
    database.db.select().from(latestCardPrices),
    database.db.select().from(intents),
    database.db.select().from(intentMatches)
  ]);
  const priceByToken = new Map(priceRows.map((price) => [price.tokenId, price]));
  const cardInputs: BundleDetectionCardInput[] = cardRows.map((card) => {
    const price = priceByToken.get(card.tokenId);
    const metadata = toRecord(card.metadata);

    return {
      tokenId: card.tokenId,
      name: card.name,
      setName: card.setName,
      cardNumber: card.cardNumber,
      characterName: card.characterName,
      tcg: card.tcg,
      ownerAddress: card.ownerAddress,
      ownerUsername: card.ownerUsername,
      grader: card.grader,
      grade: card.grade,
      language: card.language,
      serial: card.serial,
      serialNum: card.serialNum,
      status: card.status,
      askPriceUsd: toNumber(price?.askPriceUsd),
      fmvUsd: toNumber(price?.fmvUsd),
      mockData: metadata["mockData"] === true
    };
  });
  const detectedBundles = detectBundles({
    cards: cardInputs,
    intents: intentRows.map((intent) => ({
      id: intent.id,
      queryText: intent.queryText,
      intentType: intent.intentType,
      status: intent.status
    })),
    intentMatches: intentMatchRows.map((match) => ({
      intentId: match.intentId,
      tokenId: match.tokenId,
      matchScore: toNumber(match.matchScore) ?? 0
    })),
    now: startedAt
  });

  let persistedItems = 0;

  for (const bundle of detectedBundles) {
    const saved = await repos.bundles.create({
      id: bundle.id,
      bundleType: bundle.bundleType,
      name: bundle.name,
      summary: bundle.summary,
      score: bundle.score.toFixed(2),
      confidence: bundle.confidence,
      reasonJson: {
        reasons: bundle.reasons,
        riskFlags: bundle.riskFlags
      },
      totalAskUsd: bundle.totalAskUsd == null ? null : bundle.totalAskUsd.toFixed(6),
      totalFmvUsd: bundle.totalFmvUsd == null ? null : bundle.totalFmvUsd.toFixed(6),
      totalExternalMedianUsd: null,
      updatedAt: startedAt,
      metadata: {
        ...bundle.metadata,
        riskFlags: bundle.riskFlags
      }
    });

    if (saved == null) throw new Error(`Failed to persist bundle ${bundle.id}.`);

    for (const item of bundle.items) {
      const savedItem = await repos.bundles.addItem({
        bundleId: bundle.id,
        tokenId: item.tokenId,
        position: item.position,
        role: item.role
      });
      if (savedItem != null) persistedItems += 1;
    }
  }

  const finishedAt = new Date();
  await repos.syncRuns.finish(syncRun.id, {
    status: "success",
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    recordsSeen: cardInputs.length,
    recordsInserted: detectedBundles.length,
    recordsUpdated: detectedBundles.length,
    recordsFailed: 0,
    metadata: {
      algorithm: "deterministic_bundle_detector_v1",
      cards: cardInputs.length,
      bundles: detectedBundles.length,
      bundleItems: persistedItems,
      mockData: cardInputs.some((card) => card.mockData === true)
    }
  });

  console.log(
    JSON.stringify(
      {
        status: "success",
        runId: syncRun.id,
        cards: cardInputs.length,
        bundles: detectedBundles.length,
        bundleItems: persistedItems
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
  await database.close();
}
