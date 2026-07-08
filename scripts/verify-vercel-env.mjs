import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const isVercel = process.env.VERCEL === "1";
const forced = process.env.ATLAS_VERIFY_ENV === "true";

if (!isVercel && !forced) {
  process.exit(0);
}

if (!isVercel) {
  loadLocalEnv(resolve(process.cwd(), ".env"));
}

const missing = [];
const warnings = [];

function loadLocalEnv(path) {
  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    if (process.env[key] != null) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function hasValue(name) {
  const value = process.env[name];
  return value != null && value.trim().length > 0;
}

function requireValue(name) {
  if (!hasValue(name)) missing.push(name);
}

function warnValue(name) {
  if (!hasValue(name)) warnings.push(name);
}

function hasRedisPair() {
  return (
    (hasValue("INTENT_RATE_LIMIT_REDIS_REST_URL") && hasValue("INTENT_RATE_LIMIT_REDIS_REST_TOKEN")) ||
    (hasValue("UPSTASH_REDIS_REST_URL") && hasValue("UPSTASH_REDIS_REST_TOKEN"))
  );
}

requireValue("NEXT_PUBLIC_APP_URL");
requireValue("DATABASE_URL");
requireValue("JOB_SECRET");

if (!hasRedisPair()) {
  missing.push("UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN");
}

if (process.env.ALLOW_SEED_DATA === "true") {
  missing.push("ALLOW_SEED_DATA must be unset or false for Vercel live deploys");
}

warnValue("SENTRY_DSN");
warnValue("NEXT_PUBLIC_SENTRY_DSN");

if (process.env.AI_ENABLED === "true") {
  const hasOpenAi = hasValue("OPENAI_API_KEY");
  const hasGemini = hasValue("GEMINI_API_KEY");
  const hasMimo = hasValue("MIMO_API_KEY");
  if (!hasOpenAi && !hasGemini && !hasMimo) {
    missing.push("OPENAI_API_KEY or GEMINI_API_KEY or MIMO_API_KEY when AI_ENABLED=true");
  }
}

if (process.env.DISCORD_ENABLED === "true") {
  requireValue("DISCORD_APPLICATION_ID");
  requireValue("DISCORD_PUBLIC_KEY");
  requireValue("DISCORD_BOT_TOKEN");
}

for (const name of warnings) {
  console.warn(`[verify-vercel-env] Recommended env missing: ${name}`);
}

if (missing.length > 0) {
  console.error("[verify-vercel-env] Vercel deploy is missing required live environment:");
  for (const name of missing) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

console.log("[verify-vercel-env] Required Vercel live environment is present.");
