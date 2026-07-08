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

function inferVercelAppUrl() {
  if (hasValue("NEXT_PUBLIC_APP_URL")) return;

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelUrl == null || vercelUrl.trim().length === 0) return;

  process.env.NEXT_PUBLIC_APP_URL = vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
}

inferVercelAppUrl();

requireValue("RENAISS_OS_BASE_URL");
requireValue("UPSTASH_REDIS_REST_URL");
requireValue("UPSTASH_REDIS_REST_TOKEN");

warnValue("RENAISS_OS_API_KEY");
warnValue("RENAISS_OS_API_SECRET");

if (process.env.AI_ENABLED === "true") {
  requireValue("OPENROUTER_API_KEY");
  requireValue("OPENROUTER_MODEL");
}

for (const name of warnings) {
  console.warn(`[verify-vercel-env] Recommended env missing: ${name}`);
}

if (missing.length > 0) {
  console.error("[verify-vercel-env] Vercel deploy is missing required environment:");
  for (const name of missing) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

console.log("[verify-vercel-env] Required Vercel environment is present.");
