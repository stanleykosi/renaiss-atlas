import { desc, eq } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { packActivities } from "../schema.js";

export type NewPackActivity = typeof packActivities.$inferInsert;

export function createPackActivitiesRepo(db: AtlasDb) {
  return {
    async upsert(input: NewPackActivity) {
      const [activity] = await db
        .insert(packActivities)
        .values(input)
        .onConflictDoUpdate({
          target: packActivities.activityId,
          set: {
            packName: input.packName,
            packSlug: input.packSlug,
            tier: input.tier,
            fmvUsd: input.fmvUsd,
            psaId: input.psaId,
            frontImageUrl: input.frontImageUrl,
            pulledAt: input.pulledAt,
            sourceRecordId: input.sourceRecordId,
            matchedTokenId: input.matchedTokenId,
            metadata: input.metadata
          }
        })
        .returning();

      return activity;
    },

    async listByPack(packSlug: string, limit = 25) {
      return db
        .select()
        .from(packActivities)
        .where(eq(packActivities.packSlug, packSlug))
        .orderBy(desc(packActivities.pulledAt))
        .limit(limit);
    }
  };
}

