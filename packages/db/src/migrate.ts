import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDbClient } from "./client.js";
import { parseDatabaseEnv } from "./env.js";
import { loadDotEnv } from "./load-env.js";

loadDotEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."));

const env = parseDatabaseEnv(process.env);
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort((left, right) => left.localeCompare(right));
const database = createDbClient(env.DATABASE_URL, {
  databaseSsl: env.DATABASE_SSL,
  max: 1
});

try {
  for (const file of migrationFiles) {
    const migrationPath = path.join(migrationsDir, file);
    const migrationSql = readFileSync(migrationPath, "utf8");
    await database.client.unsafe(migrationSql);
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        migrations: migrationFiles
      },
      null,
      2
    )
  );
} finally {
  await database.close();
}
