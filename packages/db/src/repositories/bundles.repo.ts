import { desc, eq } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { bundleItems, bundles } from "../schema.js";

export type NewBundle = typeof bundles.$inferInsert;
export type NewBundleItem = typeof bundleItems.$inferInsert;

export function createBundlesRepo(db: AtlasDb) {
  return {
    async create(input: NewBundle) {
      const [bundle] = await db.insert(bundles).values(input).returning();
      return bundle;
    },

    async addItem(input: NewBundleItem) {
      const [item] = await db.insert(bundleItems).values(input).onConflictDoNothing().returning();
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

