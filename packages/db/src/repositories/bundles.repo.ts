import { desc, eq } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { bundleItems, bundles } from "../schema.js";

export type NewBundle = typeof bundles.$inferInsert;
export type NewBundleItem = typeof bundleItems.$inferInsert;

export function createBundlesRepo(db: AtlasDb) {
  return {
    async create(input: NewBundle) {
      const [bundle] = await db
        .insert(bundles)
        .values(input)
        .onConflictDoUpdate({
          target: bundles.id,
          set: {
            bundleType: input.bundleType,
            name: input.name,
            summary: input.summary,
            score: input.score,
            confidence: input.confidence,
            reasonJson: input.reasonJson,
            totalAskUsd: input.totalAskUsd,
            totalFmvUsd: input.totalFmvUsd,
            totalExternalMedianUsd: input.totalExternalMedianUsd,
            updatedAt: input.updatedAt,
            expiresAt: input.expiresAt,
            metadata: input.metadata
          }
        })
        .returning();
      return bundle;
    },

    async addItem(input: NewBundleItem) {
      const [item] = await db
        .insert(bundleItems)
        .values(input)
        .onConflictDoUpdate({
          target: [bundleItems.bundleId, bundleItems.tokenId],
          set: {
            position: input.position,
            role: input.role
          }
        })
        .returning();
      return item;
    },

    async list(limit = 50) {
      return db.select().from(bundles).orderBy(desc(bundles.createdAt)).limit(limit);
    },

    async listItems(bundleId: string) {
      return db.select().from(bundleItems).where(eq(bundleItems.bundleId, bundleId));
    }
  };
}
