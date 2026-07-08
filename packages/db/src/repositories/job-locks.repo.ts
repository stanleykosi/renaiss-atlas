import { and, eq, lt } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { jobLocks } from "../schema.js";

export type NewJobLock = typeof jobLocks.$inferInsert;
export type JobLock = typeof jobLocks.$inferSelect;

export type AcquireJobLockInput = {
  jobName: string;
  lockedBy: string;
  ttlMs: number;
  now?: Date;
};

export function createJobLocksRepo(db: AtlasDb) {
  return {
    async acquire(input: AcquireJobLockInput): Promise<{ acquired: true; lock: JobLock } | { acquired: false; lock: JobLock | null }> {
      const now = input.now ?? new Date();
      const expiresAt = new Date(now.getTime() + input.ttlMs);

      await db.delete(jobLocks).where(and(eq(jobLocks.jobName, input.jobName), lt(jobLocks.expiresAt, now)));

      const [lock] = await db
        .insert(jobLocks)
        .values({
          jobName: input.jobName,
          lockedBy: input.lockedBy,
          lockedAt: now,
          expiresAt
        })
        .onConflictDoNothing()
        .returning();

      if (lock != null) return { acquired: true, lock };

      const [current] = await db.select().from(jobLocks).where(eq(jobLocks.jobName, input.jobName)).limit(1);
      return { acquired: false, lock: current ?? null };
    },

    async release(jobName: string, lockedBy: string) {
      const [lock] = await db
        .delete(jobLocks)
        .where(and(eq(jobLocks.jobName, jobName), eq(jobLocks.lockedBy, lockedBy)))
        .returning();
      return lock ?? null;
    },

    async list() {
      return db.select().from(jobLocks);
    }
  };
}
