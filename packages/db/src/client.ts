import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export type AtlasDb = ReturnType<typeof createDb>;

function shouldUseSsl(databaseUrl: string, databaseSsl?: boolean): boolean | "require" {
  if (databaseSsl === true) return "require";
  return databaseUrl.includes("sslmode=require") || databaseUrl.includes("supabase") ? "require" : false;
}

export function createDb(databaseUrl: string, options: { databaseSsl?: boolean; max?: number } = {}) {
  const client = postgres(databaseUrl, {
    max: options.max ?? 10,
    ssl: shouldUseSsl(databaseUrl, options.databaseSsl)
  });

  return drizzle(client, { schema });
}

export function createDbClient(
  databaseUrl: string,
  options: { databaseSsl?: boolean; max?: number } = {}
) {
  const client = postgres(databaseUrl, {
    max: options.max ?? 10,
    ssl: shouldUseSsl(databaseUrl, options.databaseSsl)
  });

  return {
    db: drizzle(client, { schema }),
    client,
    async close() {
      await client.end();
    }
  };
}
