import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDbClient } from "./client.js";
import { parseDatabaseEnv } from "./env.js";
import { loadDotEnv } from "./load-env.js";
import {
  DEMO_WALLET,
  demoActions,
  demoAiMemos,
  demoBundleItems,
  demoBundles,
  demoCards,
  demoExternalPrices,
  demoIntentMatches,
  demoIntents,
  demoLatestPrices,
  demoLatestScores,
  demoPackActivities,
  demoPriceSnapshots,
  demoQuests,
  demoScores,
  demoSourceRecords,
  demoWalletSnapshots
} from "./seed-fixtures.js";
import {
  actionRecommendations,
  aiMemos,
  bundleItems,
  bundles,
  cardPriceSnapshots,
  cards,
  collectionQuests,
  externalPriceSnapshots,
  intentMatches,
  intents,
  latestCardPrices,
  latestScores,
  packActivities,
  scores,
  sourceRecords,
  walletSnapshots
} from "./schema.js";

loadDotEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."));

const env = parseDatabaseEnv(process.env);
const database = createDbClient(env.DATABASE_URL, {
  databaseSsl: env.DATABASE_SSL,
  max: 1
});

try {
  const db = database.db;

  await db.insert(sourceRecords).values(demoSourceRecords).onConflictDoNothing();

  for (const card of demoCards) {
    await db
      .insert(cards)
      .values(card)
      .onConflictDoUpdate({
        target: cards.tokenId,
        set: {
          itemId: card.itemId,
          name: card.name,
          normalizedName: card.normalizedName,
          setName: card.setName,
          normalizedSetName: card.normalizedSetName,
          cardNumber: card.cardNumber,
          characterName: card.characterName,
          normalizedCharacterName: card.normalizedCharacterName,
          tcg: card.tcg,
          ownerAddress: card.ownerAddress,
          ownerUsername: card.ownerUsername,
          grader: card.grader,
          grade: card.grade,
          language: card.language,
          year: card.year,
          serial: card.serial,
          serialNum: card.serialNum,
          imageUrl: card.imageUrl,
          status: card.status,
          lastSeenAt: card.lastSeenAt,
          lastSourceRecordId: card.lastSourceRecordId,
          metadata: card.metadata
        }
      });
  }

  await db.insert(cardPriceSnapshots).values(demoPriceSnapshots).onConflictDoNothing();

  for (const latestPrice of demoLatestPrices) {
    await db
      .insert(latestCardPrices)
      .values(latestPrice)
      .onConflictDoUpdate({
        target: latestCardPrices.tokenId,
        set: latestPrice
      });
  }

  await db.insert(externalPriceSnapshots).values(demoExternalPrices).onConflictDoNothing();

  for (const packActivity of demoPackActivities) {
    await db
      .insert(packActivities)
      .values(packActivity)
      .onConflictDoUpdate({
        target: packActivities.activityId,
        set: packActivity
      });
  }

  await db.insert(intents).values(demoIntents).onConflictDoNothing();
  await db.insert(intentMatches).values(demoIntentMatches).onConflictDoNothing();
  await db.insert(bundles).values(demoBundles).onConflictDoNothing();
  await db.insert(bundleItems).values(demoBundleItems).onConflictDoNothing();
  await db.insert(scores).values(demoScores).onConflictDoNothing();

  for (const latestScore of demoLatestScores) {
    await db
      .insert(latestScores)
      .values(latestScore)
      .onConflictDoUpdate({
        target: [latestScores.entityType, latestScores.entityId, latestScores.scoreType],
        set: latestScore
      });
  }

  await db.insert(actionRecommendations).values(demoActions).onConflictDoNothing();
  await db.insert(aiMemos).values(demoAiMemos).onConflictDoNothing();
  await db.insert(walletSnapshots).values(demoWalletSnapshots).onConflictDoNothing();
  await db.insert(collectionQuests).values(demoQuests).onConflictDoNothing();

  console.log(
    JSON.stringify(
      {
        status: "ok",
        demoWallet: DEMO_WALLET,
        cards: demoCards.length,
        bundles: demoBundles.length,
        intents: demoIntents.length,
        packActivities: demoPackActivities.length,
        mockData: true
      },
      null,
      2
    )
  );
} finally {
  await database.close();
}
