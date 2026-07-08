export const DISALLOWED_ATLAS_CAPABILITIES = [
  "private key collection",
  "seed phrase collection",
  "wallet signatures",
  "token approvals",
  "trade execution",
  "lending execution",
  "custody operations",
  "hidden wallet tracking",
  "unlabelled AI predictions",
  "unbounded scraping",
  "frontend secret exposure"
] as const;

export const REQUIRED_ATLAS_GUARDRAILS = [
  "source tags",
  "freshness labels",
  "confidence labels",
  "risk flags",
  "boundary validation",
  "stale-data states",
  "server-only API credentials",
  "deterministic AI fallback"
] as const;
