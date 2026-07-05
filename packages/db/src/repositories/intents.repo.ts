import { desc, eq } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { intentMatches, intents } from "../schema.js";

export type NewIntent = typeof intents.$inferInsert;
export type NewIntentMatch = typeof intentMatches.$inferInsert;

export function createIntentsRepo(db: AtlasDb) {
  return {
    async create(input: NewIntent) {
      const [intent] = await db.insert(intents).values(input).returning();
      if (intent == null) {
        throw new Error("Intent insert returned no row.");
      }
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

    async list(limit = 100) {
      return db.select().from(intents).orderBy(desc(intents.createdAt)).limit(limit);
    },

    async listMatchesForIntent(intentId: string) {
      return db
        .select()
        .from(intentMatches)
        .where(eq(intentMatches.intentId, intentId))
        .orderBy(desc(intentMatches.matchScore));
    },

    async createMatch(input: NewIntentMatch) {
      const [match] = await db
        .insert(intentMatches)
        .values(input)
        .onConflictDoNothing()
        .returning();
      return match;
    },

    async replaceMatches(intentId: string, inputs: NewIntentMatch[]) {
      await db.delete(intentMatches).where(eq(intentMatches.intentId, intentId));
      if (inputs.length === 0) return [];
      return db.insert(intentMatches).values(inputs).returning();
    }
  };
}
