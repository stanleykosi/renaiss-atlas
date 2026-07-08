import { randomUUID } from "node:crypto";
import os from "node:os";

import { createJobLocksRepo, type AtlasDb, type JobLock } from "@renaiss/db";

const DEFAULT_JOB_LOCK_TTL_MS = 15 * 60 * 1000;

export type WorkerJobLock = {
  acquired: boolean;
  jobName: string;
  lockedBy: string;
  existingLock: JobLock | null;
  release(): Promise<void>;
};

function ttlFromEnv(env: Record<string, string | undefined>): number {
  const seconds = Number(env["JOB_LOCK_TTL_SECONDS"]);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_JOB_LOCK_TTL_MS;
  return Math.min(seconds, 60 * 60) * 1000;
}

export async function acquireWorkerJobLock(
  db: AtlasDb,
  jobName: string,
  env: Record<string, string | undefined> = process.env
): Promise<WorkerJobLock> {
  const repo = createJobLocksRepo(db);
  const lockedBy = `${os.hostname()}:${process.pid}:${randomUUID()}`;
  const result = await repo.acquire({
    jobName,
    lockedBy,
    ttlMs: ttlFromEnv(env)
  });

  return {
    acquired: result.acquired,
    jobName,
    lockedBy,
    existingLock: result.acquired ? null : result.lock,
    async release() {
      if (!result.acquired) return;
      await repo.release(jobName, lockedBy);
    }
  };
}

export function lockedJobResult(lock: WorkerJobLock) {
  return {
    status: "skipped",
    reason: "Job lock is already held.",
    jobName: lock.jobName,
    lockedBy: lock.existingLock?.lockedBy ?? "unknown",
    expiresAt: lock.existingLock?.expiresAt.toISOString() ?? null
  };
}
