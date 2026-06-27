import { sql } from "drizzle-orm";
import {
  bigint as pgBigint,
  boolean,
  customType,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

const jsonObject = sql`'{}'::jsonb`;
const jsonArray = sql`'[]'::jsonb`;

export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  }
});

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
export const cardStatus = pgEnum("card_status", ["listed", "unlisted", "unknown"]);
export const confidenceLabel = pgEnum("confidence_label", ["low", "medium", "high"]);
export const intentStatus = pgEnum("intent_status", ["active", "expired", "closed", "hidden"]);
export const actionType = pgEnum("action_type", [
  "LIST",
  "MAKE_OFFER",
  "BUNDLE",
  "WATCH",
  "AVOID",
  "CREATE_INTENT",
  "MATCH_INTENT",
  "QUEST",
  "SHARE"
]);
export const scoreType = pgEnum("score_type", [
  "activity_velocity",
  "offer_depth",
  "price_consensus",
  "liquidity",
  "deal",
  "price_confidence",
  "external_comp_confidence",
  "listing_health",
  "demand",
  "bundle",
  "collector_premium",
  "collateral_readiness",
  "wallet_action_priority",
  "quest_suitability"
]);
export const bundleType = pgEnum("bundle_type", [
  "sequential_cert_pair",
  "same_card",
  "same_character",
  "same_set",
  "same_wallet",
  "same_pack_origin",
  "wallet_completion",
  "intent_driven",
  "custom"
]);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobName: text("job_name").notNull(),
  source: sourceKind("source"),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
  recordsSeen: integer("records_seen").notNull().default(0),
  recordsInserted: integer("records_inserted").notNull().default(0),
  recordsUpdated: integer("records_updated").notNull().default(0),
  recordsFailed: integer("records_failed").notNull().default(0),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").notNull().default(jsonObject)
});

export const jobLocks = pgTable("job_locks", {
  jobName: text("job_name").primaryKey(),
  lockedBy: text("locked_by").notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
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

export const cards = pgTable("cards", {
  tokenId: text("token_id").primaryKey(),
  itemId: text("item_id"),
  name: text("name").notNull().default(""),
  normalizedName: text("normalized_name").notNull().default(""),
  setName: text("set_name").notNull().default(""),
  normalizedSetName: text("normalized_set_name").notNull().default(""),
  cardNumber: text("card_number").notNull().default(""),
  characterName: text("character_name").notNull().default(""),
  normalizedCharacterName: text("normalized_character_name").notNull().default(""),
  tcg: text("tcg").notNull().default(""),
  ownerAddress: citext("owner_address"),
  ownerUsername: text("owner_username"),
  vaultLocation: text("vault_location"),
  grader: text("grader"),
  grade: text("grade"),
  language: text("language"),
  year: integer("year"),
  serial: text("serial"),
  serialNum: pgBigint("serial_num", { mode: "bigint" }),
  imageUrl: text("image_url"),
  status: cardStatus("status").notNull().default("unknown"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSourceRecordId: uuid("last_source_record_id").references(() => sourceRecords.id, {
    onDelete: "set null"
  }),
  metadata: jsonb("metadata").notNull().default(jsonObject)
});

export const cardPriceSnapshots = pgTable("card_price_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenId: text("token_id")
    .notNull()
    .references(() => cards.tokenId, { onDelete: "cascade" }),
  askPriceUsd: numeric("ask_price_usd", { precision: 18, scale: 6 }),
  askPriceRaw: text("ask_price_raw"),
  askPriceRawUnit: text("ask_price_raw_unit"),
  fmvUsd: numeric("fmv_usd", { precision: 18, scale: 6 }),
  fmvRaw: text("fmv_raw"),
  fmvRawUnit: text("fmv_raw_unit"),
  offerPriceUsd: numeric("offer_price_usd", { precision: 18, scale: 6 }),
  topOfferUsd: numeric("top_offer_usd", { precision: 18, scale: 6 }),
  lastSaleUsd: numeric("last_sale_usd", { precision: 18, scale: 6 }),
  buybackBaseValueUsd: numeric("buyback_base_value_usd", { precision: 18, scale: 6 }),
  isListed: boolean("is_listed").notNull().default(false),
  source: sourceKind("source").notNull(),
  sourceRecordId: uuid("source_record_id").references(() => sourceRecords.id, {
    onDelete: "set null"
  }),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default(jsonObject)
});

export const latestCardPrices = pgTable("latest_card_prices", {
  tokenId: text("token_id")
    .primaryKey()
    .references(() => cards.tokenId, { onDelete: "cascade" }),
  priceSnapshotId: uuid("price_snapshot_id")
    .notNull()
    .references(() => cardPriceSnapshots.id, { onDelete: "cascade" }),
  askPriceUsd: numeric("ask_price_usd", { precision: 18, scale: 6 }),
  fmvUsd: numeric("fmv_usd", { precision: 18, scale: 6 }),
  offerPriceUsd: numeric("offer_price_usd", { precision: 18, scale: 6 }),
  topOfferUsd: numeric("top_offer_usd", { precision: 18, scale: 6 }),
  lastSaleUsd: numeric("last_sale_usd", { precision: 18, scale: 6 }),
  buybackBaseValueUsd: numeric("buyback_base_value_usd", { precision: 18, scale: 6 }),
  isListed: boolean("is_listed").notNull().default(false),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const externalPriceSnapshots = pgTable("external_price_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenId: text("token_id")
    .notNull()
    .references(() => cards.tokenId, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  productTitle: text("product_title"),
  productUrl: text("product_url"),
  currency: text("currency").notNull().default("USD"),
  currentPriceUsd: numeric("current_price_usd", { precision: 18, scale: 6 }),
  lastSaleUsd: numeric("last_sale_usd", { precision: 18, scale: 6 }),
  averagePriceUsd: numeric("average_price_usd", { precision: 18, scale: 6 }),
  volume30d: integer("volume_30d"),
  gradeMatched: boolean("grade_matched"),
  languageMatched: boolean("language_matched"),
  cardNumberMatched: boolean("card_number_matched"),
  matchConfidence: numeric("match_confidence", { precision: 5, scale: 2 }).notNull().default("0"),
  matchReasons: jsonb("match_reasons").notNull().default(jsonArray),
  rejected: boolean("rejected").notNull().default(false),
  rejectionReason: text("rejection_reason"),
  sourceRecordId: uuid("source_record_id").references(() => sourceRecords.id, {
    onDelete: "set null"
  }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default(jsonObject)
});

export const packActivities = pgTable("pack_activities", {
  activityId: text("activity_id").primaryKey(),
  packName: text("pack_name").notNull(),
  packSlug: text("pack_slug").notNull(),
  tier: text("tier"),
  fmvUsd: numeric("fmv_usd", { precision: 18, scale: 6 }),
  psaId: text("psa_id"),
  frontImageUrl: text("front_image_url"),
  pulledAt: timestamp("pulled_at", { withTimezone: true }),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  sourceRecordId: uuid("source_record_id").references(() => sourceRecords.id, {
    onDelete: "set null"
  }),
  matchedTokenId: text("matched_token_id").references(() => cards.tokenId, {
    onDelete: "set null"
  }),
  metadata: jsonb("metadata").notNull().default(jsonObject)
});

export const intents = pgTable("intents", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorAlias: text("creator_alias"),
  creatorWallet: citext("creator_wallet"),
  creatorDiscordId: text("creator_discord_id"),
  intentType: text("intent_type").notNull(),
  queryText: text("query_text").notNull(),
  tcg: text("tcg"),
  characterName: text("character_name"),
  setName: text("set_name"),
  cardNumber: text("card_number"),
  grader: text("grader"),
  grade: text("grade"),
  language: text("language"),
  minYear: integer("min_year"),
  maxYear: integer("max_year"),
  minPriceUsd: numeric("min_price_usd", { precision: 18, scale: 6 }),
  maxPriceUsd: numeric("max_price_usd", { precision: 18, scale: 6 }),
  requiresSerialAdjacency: boolean("requires_serial_adjacency").notNull().default(false),
  requiresExternalComp: boolean("requires_external_comp").notNull().default(false),
  minLiquidityScore: numeric("min_liquidity_score", { precision: 5, scale: 2 }),
  status: intentStatus("status").notNull().default("active"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default(jsonObject)
});

export const intentMatches = pgTable("intent_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  intentId: uuid("intent_id")
    .notNull()
    .references(() => intents.id, { onDelete: "cascade" }),
  tokenId: text("token_id")
    .notNull()
    .references(() => cards.tokenId, { onDelete: "cascade" }),
  matchScore: numeric("match_score", { precision: 5, scale: 2 }).notNull().default("0"),
  confidence: confidenceLabel("confidence").notNull().default("low"),
  reasons: jsonb("reasons").notNull().default(jsonArray),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const bundles = pgTable("bundles", {
  id: uuid("id").primaryKey().defaultRandom(),
  bundleType: bundleType("bundle_type").notNull(),
  name: text("name").notNull(),
  summary: text("summary"),
  score: numeric("score", { precision: 5, scale: 2 }).notNull().default("0"),
  confidence: confidenceLabel("confidence").notNull().default("low"),
  reasonJson: jsonb("reason_json").notNull().default(jsonObject),
  totalAskUsd: numeric("total_ask_usd", { precision: 18, scale: 6 }),
  totalFmvUsd: numeric("total_fmv_usd", { precision: 18, scale: 6 }),
  totalExternalMedianUsd: numeric("total_external_median_usd", { precision: 18, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default(jsonObject)
});

export const bundleItems = pgTable(
  "bundle_items",
  {
    bundleId: uuid("bundle_id")
      .notNull()
      .references(() => bundles.id, { onDelete: "cascade" }),
    tokenId: text("token_id")
      .notNull()
      .references(() => cards.tokenId, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    role: text("role"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [primaryKey({ columns: [table.bundleId, table.tokenId] })]
);

export const scores = pgTable("scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  scoreType: scoreType("score_type").notNull(),
  scoreValue: numeric("score_value", { precision: 5, scale: 2 }).notNull(),
  confidence: confidenceLabel("confidence").notNull().default("low"),
  inputsHash: text("inputs_hash").notNull(),
  reasonsJson: jsonb("reasons_json").notNull().default(jsonArray),
  riskFlagsJson: jsonb("risk_flags_json").notNull().default(jsonArray),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true })
});

export const latestScores = pgTable(
  "latest_scores",
  {
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    scoreType: scoreType("score_type").notNull(),
    scoreId: uuid("score_id")
      .notNull()
      .references(() => scores.id, { onDelete: "cascade" }),
    scoreValue: numeric("score_value", { precision: 5, scale: 2 }).notNull(),
    confidence: confidenceLabel("confidence").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull()
  },
  (table) => [primaryKey({ columns: [table.entityType, table.entityId, table.scoreType] })]
);

export const actionRecommendations = pgTable("action_recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  actionType: actionType("action_type").notNull(),
  priority: integer("priority").notNull().default(100),
  title: text("title").notNull(),
  reason: text("reason").notNull(),
  confidence: confidenceLabel("confidence").notNull().default("low"),
  impact: text("impact"),
  risksJson: jsonb("risks_json").notNull().default(jsonArray),
  sourceIdsJson: jsonb("source_ids_json").notNull().default(jsonArray),
  ctaJson: jsonb("cta_json").notNull().default(jsonObject),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default(jsonObject)
});

export const aiMemos = pgTable("ai_memos", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputHash: text("input_hash").notNull(),
  outputJson: jsonb("output_json").notNull(),
  validationStatus: text("validation_status").notNull(),
  sourceIdsJson: jsonb("source_ids_json").notNull().default(jsonArray),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default(jsonObject)
});

export const walletSnapshots = pgTable("wallet_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: citext("wallet_address").notNull(),
  totalCards: integer("total_cards").notNull().default(0),
  listedCards: integer("listed_cards").notNull().default(0),
  unlistedCards: integer("unlisted_cards").notNull().default(0),
  totalFmvUsd: numeric("total_fmv_usd", { precision: 18, scale: 6 }),
  totalAskUsd: numeric("total_ask_usd", { precision: 18, scale: 6 }),
  avgLiquidityScore: numeric("avg_liquidity_score", { precision: 5, scale: 2 }),
  highConfidenceCompRatio: numeric("high_confidence_comp_ratio", { precision: 5, scale: 2 }),
  staleDataRatio: numeric("stale_data_ratio", { precision: 5, scale: 2 }),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default(jsonObject)
});

export const collectionQuests = pgTable("collection_quests", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  questType: text("quest_type").notNull(),
  rulesJson: jsonb("rules_json").notNull().default(jsonObject),
  rewardLabel: text("reward_label"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default(jsonObject)
});

export const questSubmissions = pgTable("quest_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  questId: uuid("quest_id")
    .notNull()
    .references(() => collectionQuests.id, { onDelete: "cascade" }),
  walletAddress: citext("wallet_address"),
  discordId: text("discord_id"),
  submissionJson: jsonb("submission_json").notNull().default(jsonObject),
  score: numeric("score", { precision: 5, scale: 2 }),
  status: text("status").notNull().default("submitted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const discordEvents = pgTable("discord_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  interactionId: text("interaction_id"),
  discordUserId: text("discord_user_id"),
  commandName: text("command_name"),
  requestJson: jsonb("request_json"),
  responseJson: jsonb("response_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const dataQualityEvents = pgTable("data_quality_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: sourceKind("source"),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  severity: text("severity").notNull(),
  code: text("code").notNull(),
  message: text("message").notNull(),
  details: jsonb("details").notNull().default(jsonObject),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorType: text("actor_type").notNull().default("system"),
  actorId: text("actor_id"),
  eventName: text("event_name").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").notNull().default(jsonObject),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export type DbCard = typeof cards.$inferSelect;
export type NewDbCard = typeof cards.$inferInsert;
export type DbSourceRecord = typeof sourceRecords.$inferSelect;
export type NewDbSourceRecord = typeof sourceRecords.$inferInsert;
