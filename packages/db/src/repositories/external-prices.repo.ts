import { desc, eq } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { externalPriceSnapshots } from "../schema.js";

export type NewExternalPriceSnapshot = typeof externalPriceSnapshots.$inferInsert;

export function createExternalPricesRepo(db: AtlasDb) {
  return {
    async create(input: NewExternalPriceSnapshot) {
      const [snapshot] = await db.insert(externalPriceSnapshots).values(input).returning();
      return snapshot;
    },

    async listByTokenId(tokenId: string) {
      return db
        .select()
        .from(externalPriceSnapshots)
        .where(eq(externalPriceSnapshots.tokenId, tokenId))
        .orderBy(desc(externalPriceSnapshots.fetchedAt));
    }
  };
}

