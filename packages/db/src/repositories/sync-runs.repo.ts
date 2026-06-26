import { desc, eq } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { syncRuns } from "../schema.js";

export type NewSyncRun = typeof syncRuns.$inferInsert;

export function createSyncRunsRepo(db: AtlasDb) {
  return {
    async start(input: NewSyncRun) {
      const [run] = await db.insert(syncRuns).values(input).returning();
      return run;
    },

    async latest(jobName?: string, limit = 20) {
      const query = db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(limit);
      if (jobName == null) return query;
      return db
        .select()
        .from(syncRuns)
        .where(eq(syncRuns.jobName, jobName))
        .orderBy(desc(syncRuns.startedAt))
        .limit(limit);
    }
  };
}

