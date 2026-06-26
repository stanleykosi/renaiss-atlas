import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDbClient } from "./client.js";
import { parseDatabaseEnv } from "./env.js";
import { loadDotEnv } from "./load-env.js";

loadDotEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."));

const env = parseDatabaseEnv(process.env);
const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations/0000_initial.sql"
);
const migrationSql = readFileSync(migrationPath, "utf8");
const database = createDbClient(env.DATABASE_URL, {
  databaseSsl: env.DATABASE_SSL,
  max: 1
});

try {
  await database.client.unsafe(migrationSql);
  console.log(
    JSON.stringify(
      {
        status: "ok",
        migration: "0000_initial.sql"
      },
      null,
      2
    )
  );
} finally {
  await database.close();
}
