import { and, desc, eq } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { aiMemos } from "../schema.js";

export type NewAiMemo = typeof aiMemos.$inferInsert;

export function createAiMemosRepo(db: AtlasDb) {
  return {
    async create(input: NewAiMemo) {
      const [memo] = await db.insert(aiMemos).values(input).onConflictDoNothing().returning();
      return memo;
    },

    async latestForSubject(subjectType: string, subjectId: string) {
      const [memo] = await db
        .select()
        .from(aiMemos)
        .where(and(eq(aiMemos.subjectType, subjectType), eq(aiMemos.subjectId, subjectId)))
        .orderBy(desc(aiMemos.createdAt))
        .limit(1);

      return memo;
    }
  };
}
