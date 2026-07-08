export function allowSeedData(env: Record<string, string | undefined> = process.env): boolean {
  return env["ALLOW_SEED_DATA"] === "true";
}

export function hasDatabaseUrl(env: Record<string, string | undefined> = process.env): boolean {
  return env["DATABASE_URL"] != null && env["DATABASE_URL"].trim().length > 0;
}
