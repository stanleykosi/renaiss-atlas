import { createDbClient, DatabaseEnvSchema } from "@renaiss/db";

import { getAdminSyncOverview } from "@/lib/admin-sync-data";
import { logError } from "@/lib/logger";
import { allowSeedData } from "./data-mode";

export type HealthCheckStatus = "pass" | "warn" | "fail" | "skip";

export type HealthCheck = {
  name: string;
  status: HealthCheckStatus;
  message: string;
  observedAt: string;
};

export type HealthReport = {
  status: "ok" | "degraded" | "fail";
  service: "renaiss-atlas-web";
  mode: "seed" | "database";
  readOnly: true;
  generatedAt: string;
  checks: HealthCheck[];
  summary: {
    warnings: number;
    failures: number;
    mockData: boolean;
  };
};

function hasValue(value: string | undefined): boolean {
  return value != null && value.trim().length > 0;
}

function check(name: string, status: HealthCheckStatus, message: string, observedAt: string): HealthCheck {
  return {
    name,
    status,
    message,
    observedAt
  };
}

async function databaseCheck(now: string): Promise<HealthCheck> {
  if (allowSeedData()) {
    return check("database", "skip", "Local seed fixture mode does not require a database connection.", now);
  }

  const env = DatabaseEnvSchema.safeParse(process.env);
  if (!env.success) {
    return check("database", "fail", "DATABASE_URL is required for live Atlas deployment.", now);
  }

  const database = createDbClient(env.data.DATABASE_URL, {
    databaseSsl: env.data.DATABASE_SSL,
    max: 1
  });

  try {
    await database.client`select 1`;
    return check("database", "pass", "Postgres connection is reachable.", now);
  } catch (error) {
    logError("health_database_check_failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return check("database", "fail", "Postgres connection failed.", now);
  } finally {
    await database.close();
  }
}

export async function getHealthReport(): Promise<HealthReport> {
  const now = new Date().toISOString();
  const [database, admin] = await Promise.all([databaseCheck(now), getAdminSyncOverview()]);
  const seedDataAllowed = allowSeedData();
  const checks: HealthCheck[] = [
    check("runtime", "pass", "Next.js route handlers are responding.", now),
    database,
    check(
      "redis-rate-limit",
      hasValue(process.env["INTENT_RATE_LIMIT_REDIS_REST_URL"]) || hasValue(process.env["UPSTASH_REDIS_REST_URL"])
        ? "pass"
        : seedDataAllowed
          ? "warn"
          : "fail",
      hasValue(process.env["INTENT_RATE_LIMIT_REDIS_REST_URL"]) || hasValue(process.env["UPSTASH_REDIS_REST_URL"])
        ? "Redis REST limiter is configured."
        : seedDataAllowed
          ? "Redis REST limiter is not configured; seed fixtures are local-only."
          : "Redis REST limiter is required for live intent and admin writes.",
      now
    ),
    check(
      "sentry",
      hasValue(process.env["SENTRY_DSN"]) || hasValue(process.env["NEXT_PUBLIC_SENTRY_DSN"]) ? "pass" : "warn",
      hasValue(process.env["SENTRY_DSN"]) || hasValue(process.env["NEXT_PUBLIC_SENTRY_DSN"])
        ? "Sentry DSN is configured."
        : "Sentry DSN is not configured.",
      now
    ),
    check(
      "market-freshness",
      admin.health.marketFreshness === "fresh" ? "pass" : "warn",
      `Marketplace freshness is ${admin.health.marketFreshness}.`,
      now
    )
  ];
  const warnings = checks.filter((item) => item.status === "warn").length + admin.warnings.length;
  const failures = checks.filter((item) => item.status === "fail").length;

  return {
    status: failures > 0 ? "fail" : warnings > 0 ? "degraded" : "ok",
    service: "renaiss-atlas-web",
    mode: admin.mode,
    readOnly: true,
    generatedAt: now,
    checks,
    summary: {
      warnings,
      failures,
      mockData: admin.health.mockData
    }
  };
}
