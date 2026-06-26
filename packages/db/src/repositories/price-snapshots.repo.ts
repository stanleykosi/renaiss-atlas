import { desc, eq } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { cardPriceSnapshots, latestCardPrices } from "../schema.js";

export type NewCardPriceSnapshot = typeof cardPriceSnapshots.$inferInsert;

export function createPriceSnapshotsRepo(db: AtlasDb) {
  return {
    async create(input: NewCardPriceSnapshot) {
      const [snapshot] = await db.insert(cardPriceSnapshots).values(input).returning();
      return snapshot;
    },

    async setLatestFromSnapshot(snapshot: typeof cardPriceSnapshots.$inferSelect) {
      const [latest] = await db
        .insert(latestCardPrices)
        .values({
          tokenId: snapshot.tokenId,
          priceSnapshotId: snapshot.id,
          askPriceUsd: snapshot.askPriceUsd,
          fmvUsd: snapshot.fmvUsd,
          offerPriceUsd: snapshot.offerPriceUsd,
          topOfferUsd: snapshot.topOfferUsd,
          lastSaleUsd: snapshot.lastSaleUsd,
          buybackBaseValueUsd: snapshot.buybackBaseValueUsd,
          isListed: snapshot.isListed,
          observedAt: snapshot.observedAt,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: latestCardPrices.tokenId,
          set: {
            priceSnapshotId: snapshot.id,
            askPriceUsd: snapshot.askPriceUsd,
            fmvUsd: snapshot.fmvUsd,
            offerPriceUsd: snapshot.offerPriceUsd,
            topOfferUsd: snapshot.topOfferUsd,
            lastSaleUsd: snapshot.lastSaleUsd,
            buybackBaseValueUsd: snapshot.buybackBaseValueUsd,
            isListed: snapshot.isListed,
            observedAt: snapshot.observedAt,
            updatedAt: new Date()
          }
        })
        .returning();

      return latest;
    },

    async latestForCard(tokenId: string) {
      const [snapshot] = await db
        .select()
        .from(cardPriceSnapshots)
        .where(eq(cardPriceSnapshots.tokenId, tokenId))
        .orderBy(desc(cardPriceSnapshots.observedAt))
        .limit(1);

      return snapshot;
    }
  };
}

