-- DATABASE_SCHEMA.sql — Renaiss Atlas
-- Target: PostgreSQL 16+
-- Convert to Drizzle migrations during implementation.
-- Money values use numeric(18, 6) for USD-like values plus raw source strings where needed.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$ BEGIN
  CREATE TYPE source_kind AS ENUM (
    'renaiss_marketplace_v0',
    'renaiss_trpc_collectible_list',
    'renaiss_gacha_rsc',
    'snkrdunk',
    'pricecharting',
    'exchange_rates',
    'discord',
    'manual_seed',
    'mock'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE parse_status AS ENUM ('pending', 'parsed', 'partial', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE card_status AS ENUM ('listed', 'unlisted', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE confidence_label AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE intent_status AS ENUM ('active', 'expired', 'closed', 'hidden');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE action_type AS ENUM ('LIST','MAKE_OFFER','BUNDLE','WATCH','AVOID','CREATE_INTENT','MATCH_INTENT','QUEST','SHARE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE score_type AS ENUM (
    'activity_velocity','offer_depth','price_consensus','liquidity','deal','price_confidence','external_comp_confidence','listing_health','demand','bundle','collector_premium','collateral_readiness','wallet_action_priority','quest_suitability'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bundle_type AS ENUM ('sequential_cert_pair','same_card','same_character','same_set','same_pack_origin','wallet_completion','intent_driven','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  source source_kind,
  status text NOT NULL CHECK (status IN ('started','success','partial','failed','skipped')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  records_seen integer NOT NULL DEFAULT 0,
  records_inserted integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  records_failed integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_job_started ON sync_runs(job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_source_started ON sync_runs(source, started_at DESC);

CREATE TABLE IF NOT EXISTS job_locks (
  job_name text PRIMARY KEY,
  locked_by text NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source source_kind NOT NULL,
  source_url text NOT NULL,
  request_fingerprint text,
  response_status integer,
  response_hash text,
  raw_json jsonb,
  raw_text_excerpt text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  parse_status parse_status NOT NULL DEFAULT 'pending',
  parse_error text,
  sync_run_id uuid REFERENCES sync_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_source_records_source_fetched ON source_records(source, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_records_hash ON source_records(response_hash);

CREATE TABLE IF NOT EXISTS cards (
  token_id text PRIMARY KEY,
  item_id text,
  name text NOT NULL DEFAULT '',
  normalized_name text NOT NULL DEFAULT '',
  set_name text NOT NULL DEFAULT '',
  normalized_set_name text NOT NULL DEFAULT '',
  card_number text NOT NULL DEFAULT '',
  character_name text NOT NULL DEFAULT '',
  normalized_character_name text NOT NULL DEFAULT '',
  tcg text NOT NULL DEFAULT '',
  owner_address citext,
  owner_username text,
  vault_location text,
  grader text,
  grade text,
  language text,
  year integer,
  serial text,
  serial_num bigint,
  image_url text,
  status card_status NOT NULL DEFAULT 'unknown',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cards_owner ON cards(owner_address);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_serial_num ON cards(serial_num);
CREATE INDEX IF NOT EXISTS idx_cards_grader_grade ON cards(grader, grade);
CREATE INDEX IF NOT EXISTS idx_cards_language ON cards(language);
CREATE INDEX IF NOT EXISTS idx_cards_year ON cards(year);
CREATE INDEX IF NOT EXISTS idx_cards_search ON cards USING gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(set_name,'') || ' ' || coalesce(character_name,'') || ' ' || coalesce(card_number,'')));

CREATE TABLE IF NOT EXISTS card_price_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id text NOT NULL REFERENCES cards(token_id) ON DELETE CASCADE,
  ask_price_usd numeric(18, 6),
  ask_price_raw text,
  ask_price_raw_unit text,
  fmv_usd numeric(18, 6),
  fmv_raw text,
  fmv_raw_unit text,
  offer_price_usd numeric(18, 6),
  top_offer_usd numeric(18, 6),
  last_sale_usd numeric(18, 6),
  buyback_base_value_usd numeric(18, 6),
  is_listed boolean NOT NULL DEFAULT false,
  source source_kind NOT NULL,
  source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_price_snapshots_token_time ON card_price_snapshots(token_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_listed ON card_price_snapshots(is_listed, observed_at DESC);

CREATE TABLE IF NOT EXISTS latest_card_prices (
  token_id text PRIMARY KEY REFERENCES cards(token_id) ON DELETE CASCADE,
  price_snapshot_id uuid NOT NULL REFERENCES card_price_snapshots(id) ON DELETE CASCADE,
  ask_price_usd numeric(18, 6),
  fmv_usd numeric(18, 6),
  offer_price_usd numeric(18, 6),
  top_offer_usd numeric(18, 6),
  last_sale_usd numeric(18, 6),
  buyback_base_value_usd numeric(18, 6),
  is_listed boolean NOT NULL DEFAULT false,
  observed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_latest_prices_ask ON latest_card_prices(ask_price_usd);
CREATE INDEX IF NOT EXISTS idx_latest_prices_fmv ON latest_card_prices(fmv_usd);
CREATE INDEX IF NOT EXISTS idx_latest_prices_listed ON latest_card_prices(is_listed);

CREATE TABLE IF NOT EXISTS external_price_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id text NOT NULL REFERENCES cards(token_id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('snkrdunk','pricecharting','manual','mock')),
  product_title text,
  product_url text,
  currency text NOT NULL DEFAULT 'USD',
  current_price_usd numeric(18, 6),
  last_sale_usd numeric(18, 6),
  average_price_usd numeric(18, 6),
  volume_30d integer,
  grade_matched boolean,
  language_matched boolean,
  card_number_matched boolean,
  match_confidence numeric(5, 2) NOT NULL DEFAULT 0,
  match_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  rejected boolean NOT NULL DEFAULT false,
  rejection_reason text,
  source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_external_prices_token_platform_time ON external_price_snapshots(token_id, platform, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_prices_confidence ON external_price_snapshots(match_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_external_prices_rejected ON external_price_snapshots(rejected);

CREATE TABLE IF NOT EXISTS pack_activities (
  activity_id text PRIMARY KEY,
  pack_name text NOT NULL,
  pack_slug text NOT NULL,
  tier text,
  fmv_usd numeric(18, 6),
  psa_id text,
  front_image_url text,
  pulled_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  matched_token_id text REFERENCES cards(token_id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_pack_activities_pack_time ON pack_activities(pack_slug, pulled_at DESC);
CREATE INDEX IF NOT EXISTS idx_pack_activities_tier ON pack_activities(tier);
CREATE INDEX IF NOT EXISTS idx_pack_activities_psa ON pack_activities(psa_id);

CREATE TABLE IF NOT EXISTS intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_alias text,
  creator_wallet citext,
  creator_discord_id text,
  intent_type text NOT NULL CHECK (intent_type IN ('buy','sell','bundle','trade','watch','quest')),
  query_text text NOT NULL,
  tcg text,
  character_name text,
  set_name text,
  card_number text,
  grader text,
  grade text,
  language text,
  min_year integer,
  max_year integer,
  min_price_usd numeric(18, 6),
  max_price_usd numeric(18, 6),
  requires_serial_adjacency boolean NOT NULL DEFAULT false,
  requires_external_comp boolean NOT NULL DEFAULT false,
  min_liquidity_score numeric(5, 2),
  status intent_status NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_intents_status_created ON intents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intents_wallet ON intents(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_intents_search ON intents USING gin (to_tsvector('simple', coalesce(query_text,'') || ' ' || coalesce(character_name,'') || ' ' || coalesce(set_name,'') || ' ' || coalesce(card_number,'')));

CREATE TABLE IF NOT EXISTS intent_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL REFERENCES intents(id) ON DELETE CASCADE,
  token_id text NOT NULL REFERENCES cards(token_id) ON DELETE CASCADE,
  match_score numeric(5, 2) NOT NULL DEFAULT 0,
  confidence confidence_label NOT NULL DEFAULT 'low',
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(intent_id, token_id)
);

CREATE INDEX IF NOT EXISTS idx_intent_matches_token ON intent_matches(token_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_intent_matches_intent ON intent_matches(intent_id, match_score DESC);

CREATE TABLE IF NOT EXISTS bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_type bundle_type NOT NULL,
  name text NOT NULL,
  summary text,
  score numeric(5, 2) NOT NULL DEFAULT 0,
  confidence confidence_label NOT NULL DEFAULT 'low',
  reason_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_ask_usd numeric(18, 6),
  total_fmv_usd numeric(18, 6),
  total_external_median_usd numeric(18, 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_bundles_type_score ON bundles(bundle_type, score DESC);
CREATE INDEX IF NOT EXISTS idx_bundles_created ON bundles(created_at DESC);

CREATE TABLE IF NOT EXISTS bundle_items (
  bundle_id uuid NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  token_id text NOT NULL REFERENCES cards(token_id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(bundle_id, token_id)
);

CREATE INDEX IF NOT EXISTS idx_bundle_items_token ON bundle_items(token_id);

CREATE TABLE IF NOT EXISTS scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('card','wallet','bundle','intent','pack')),
  entity_id text NOT NULL,
  score_type score_type NOT NULL,
  score_value numeric(5, 2) NOT NULL CHECK (score_value >= 0 AND score_value <= 100),
  confidence confidence_label NOT NULL DEFAULT 'low',
  inputs_hash text NOT NULL,
  reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_flags_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(entity_type, entity_id, score_type, inputs_hash)
);

CREATE INDEX IF NOT EXISTS idx_scores_entity ON scores(entity_type, entity_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_type_value ON scores(score_type, score_value DESC);

CREATE TABLE IF NOT EXISTS latest_scores (
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  score_type score_type NOT NULL,
  score_id uuid NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  score_value numeric(5, 2) NOT NULL,
  confidence confidence_label NOT NULL,
  computed_at timestamptz NOT NULL,
  PRIMARY KEY(entity_type, entity_id, score_type)
);

CREATE TABLE IF NOT EXISTS action_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('card','wallet','bundle','intent','pack')),
  subject_id text NOT NULL,
  action_type action_type NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  title text NOT NULL,
  reason text NOT NULL,
  confidence confidence_label NOT NULL DEFAULT 'low',
  impact text,
  risks_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_actions_subject_priority ON action_recommendations(subject_type, subject_id, priority ASC);
CREATE INDEX IF NOT EXISTS idx_actions_type_created ON action_recommendations(action_type, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('card','wallet','bundle','intent','pack')),
  subject_id text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  input_hash text NOT NULL,
  output_json jsonb NOT NULL,
  validation_status text NOT NULL CHECK (validation_status IN ('valid','invalid','fallback')),
  source_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(subject_type, subject_id, input_hash)
);

CREATE INDEX IF NOT EXISTS idx_ai_memos_subject_created ON ai_memos(subject_type, subject_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wallet_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address citext NOT NULL,
  total_cards integer NOT NULL DEFAULT 0,
  listed_cards integer NOT NULL DEFAULT 0,
  unlisted_cards integer NOT NULL DEFAULT 0,
  total_fmv_usd numeric(18, 6),
  total_ask_usd numeric(18, 6),
  avg_liquidity_score numeric(5, 2),
  high_confidence_comp_ratio numeric(5, 2),
  stale_data_ratio numeric(5, 2),
  computed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_wallet_snapshots_wallet_time ON wallet_snapshots(wallet_address, computed_at DESC);

CREATE TABLE IF NOT EXISTS collection_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  quest_type text NOT NULL,
  rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_label text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS quest_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id uuid NOT NULL REFERENCES collection_quests(id) ON DELETE CASCADE,
  wallet_address citext,
  discord_id text,
  submission_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric(5, 2),
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discord_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id text,
  discord_user_id text,
  command_name text,
  request_json jsonb,
  response_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discord_events_user_time ON discord_events(discord_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS data_quality_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source source_kind,
  entity_type text,
  entity_id text,
  severity text NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  code text NOT NULL,
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dq_events_entity ON data_quality_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dq_events_severity ON data_quality_events(severity, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL DEFAULT 'system',
  actor_id text,
  event_name text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW card_current_intelligence AS
SELECT
  c.token_id,
  c.item_id,
  c.name,
  c.set_name,
  c.card_number,
  c.character_name,
  c.tcg,
  c.owner_address,
  c.grader,
  c.grade,
  c.language,
  c.year,
  c.serial,
  c.serial_num,
  c.image_url,
  c.status,
  p.ask_price_usd,
  p.fmv_usd,
  p.offer_price_usd,
  p.top_offer_usd,
  p.last_sale_usd,
  p.buyback_base_value_usd,
  p.is_listed,
  p.observed_at AS price_observed_at,
  liq.score_value AS liquidity_score,
  deal.score_value AS deal_score,
  conf.score_value AS price_confidence_score,
  demand.score_value AS demand_score,
  bun.score_value AS bundle_score,
  coll.score_value AS collateral_readiness_score
FROM cards c
LEFT JOIN latest_card_prices p ON p.token_id = c.token_id
LEFT JOIN latest_scores liq ON liq.entity_type='card' AND liq.entity_id=c.token_id AND liq.score_type='liquidity'
LEFT JOIN latest_scores deal ON deal.entity_type='card' AND deal.entity_id=c.token_id AND deal.score_type='deal'
LEFT JOIN latest_scores conf ON conf.entity_type='card' AND conf.entity_id=c.token_id AND conf.score_type='price_confidence'
LEFT JOIN latest_scores demand ON demand.entity_type='card' AND demand.entity_id=c.token_id AND demand.score_type='demand'
LEFT JOIN latest_scores bun ON bun.entity_type='card' AND bun.entity_id=c.token_id AND bun.score_type='bundle'
LEFT JOIN latest_scores coll ON coll.entity_type='card' AND coll.entity_id=c.token_id AND coll.score_type='collateral_readiness';

CREATE OR REPLACE VIEW market_health_rollup AS
SELECT
  count(*) AS total_cards,
  count(*) FILTER (WHERE status='listed') AS listed_cards,
  count(*) FILTER (WHERE status='unlisted') AS unlisted_cards,
  sum(ask_price_usd) FILTER (WHERE is_listed) AS total_ask_usd,
  sum(fmv_usd) AS total_fmv_usd,
  count(*) FILTER (WHERE ask_price_usd IS NOT NULL AND fmv_usd IS NOT NULL AND ask_price_usd < fmv_usd) AS under_fmv_count,
  count(*) FILTER (WHERE ask_price_usd IS NOT NULL AND fmv_usd IS NOT NULL AND ask_price_usd > fmv_usd) AS over_fmv_count,
  avg(liquidity_score) AS avg_liquidity_score,
  avg(price_confidence_score) AS avg_price_confidence_score
FROM card_current_intelligence;
