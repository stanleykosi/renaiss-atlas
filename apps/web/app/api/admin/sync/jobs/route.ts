import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAtlasRepositories,
  createDbClient,
  DatabaseEnvSchema
} from "@renaiss/db";

import { adminSyncJobs } from "@/lib/admin-sync-data";
import { allowSeedData } from "@/lib/data-mode";
import { logWarn } from "@/lib/logger";
import { checkAdminSyncRateLimit } from "@/lib/redis-rate-limit";

const AdminSyncJobRequestSchema = z.object({
  jobName: z.enum([
    "sync:renaiss:marketplace",
    "sync:gacha",
    "sync:external:comps",
    "score:cards",
    "detect:bundles",
    "intents"
  ])
});

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice("bearer ".length).trim();
}

function clientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor ?? realIp ?? "local";
}

function commandFor(jobName: string): string {
  return adminSyncJobs.find((job) => job.id === jobName)?.command ?? "pnpm jobs:sync:renaiss";
}

export async function POST(request: Request) {
  const secret = process.env["JOB_SECRET"];
  if (secret == null || secret.length < 24) {
    return NextResponse.json({ error: "JOB_SECRET is not configured." }, { status: 503 });
  }

  if (bearerToken(request) !== secret) {
    logWarn("admin_sync_unauthorized", { path: "/api/admin/sync/jobs" });
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = AdminSyncJobRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sync job request." }, { status: 400 });
  }

  const limited = await checkAdminSyncRateLimit({
    identifier: `${clientKey(request)}:${parsed.data.jobName}`
  });
  if (limited.status !== "allowed") {
    return NextResponse.json(
      {
        error: limited.status === "unavailable" ? "Admin sync rate limiting is unavailable." : "Too many sync requests.",
        retryAfterSeconds: limited.retryAfterSeconds
      },
      {
        status: limited.status === "unavailable" ? 503 : 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) }
      }
    );
  }

  if (allowSeedData()) {
    return NextResponse.json(
      {
        status: "accepted",
        mode: "seed",
        jobName: parsed.data.jobName,
        command: commandFor(parsed.data.jobName),
        message: "Local seed fixture mode records no live sync work."
      },
      { status: 202 }
    );
  }

  const env = DatabaseEnvSchema.safeParse(process.env);
  if (!env.success) {
    return NextResponse.json({ error: "DATABASE_URL is required for admin sync requests." }, { status: 503 });
  }

  const database = createDbClient(env.data.DATABASE_URL, {
    databaseSsl: env.data.DATABASE_SSL,
    max: 1
  });

  try {
    const repos = createAtlasRepositories(database.db);
    const locks = await repos.jobLocks.list();
    const activeLock = locks.find((lock) => lock.jobName === parsed.data.jobName);

    if (activeLock != null && activeLock.expiresAt.getTime() > Date.now()) {
      return NextResponse.json(
        {
          error: "Job is locked.",
          jobName: parsed.data.jobName,
          expiresAt: activeLock.expiresAt.toISOString()
        },
        { status: 423 }
      );
    }

    const run = await repos.syncRuns.start({
      jobName: parsed.data.jobName,
      source: null,
      status: "requested",
      startedAt: new Date(),
      metadata: {
        manual: true,
        command: commandFor(parsed.data.jobName)
      }
    });

    return NextResponse.json(
      {
        status: "requested",
        runId: run?.id ?? null,
        jobName: parsed.data.jobName,
        command: commandFor(parsed.data.jobName)
      },
      { status: 202 }
    );
  } finally {
    await database.close();
  }
}
