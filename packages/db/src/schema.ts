import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const sourceKind = pgEnum("source_kind", [
  "renaiss_marketplace_v0",
  "renaiss_trpc_collectible_list",
  "renaiss_gacha_rsc",
  "snkrdunk",
  "pricecharting",
  "exchange_rates",
  "discord",
  "manual_seed",
  "mock"
]);

export const parseStatus = pgEnum("parse_status", ["pending", "parsed", "partial", "failed"]);

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobName: text("job_name").notNull(),
  source: sourceKind("source"),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  recordsSeen: integer("records_seen").notNull().default(0),
  recordsFailed: integer("records_failed").notNull().default(0),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").notNull().default({})
});

export const sourceRecords = pgTable("source_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: sourceKind("source").notNull(),
  sourceUrl: text("source_url").notNull(),
  requestFingerprint: text("request_fingerprint"),
  responseStatus: integer("response_status"),
  responseHash: text("response_hash"),
  rawJson: jsonb("raw_json"),
  rawTextExcerpt: text("raw_text_excerpt"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  parseStatus: parseStatus("parse_status").notNull().default("pending"),
  parseError: text("parse_error"),
  syncRunId: uuid("sync_run_id").references(() => syncRuns.id, { onDelete: "set null" })
});
