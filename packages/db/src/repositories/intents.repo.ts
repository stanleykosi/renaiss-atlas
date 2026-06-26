import { desc, eq } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { intentMatches, intents } from "../schema.js";

export type NewIntent = typeof intents.$inferInsert;
export type NewIntentMatch = typeof intentMatches.$inferInsert;

export function createIntentsRepo(db: AtlasDb) {
  return {
    async create(input: NewIntent) {
      const [intent] = await db.insert(intents).values(input).returning();
      return intent;
    },

    async listActive(limit = 50) {
      return db
        .select()
        .from(intents)
        .where(eq(intents.status, "active"))
        .orderBy(desc(intents.createdAt))
        .limit(limit);
    },

    async createMatch(input: NewIntentMatch) {
      const [match] = await db
        .insert(intentMatches)
        .values(input)
        .onConflictDoNothing()
        .returning();
      return match;
    }
  };
}

