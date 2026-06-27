import { and, desc, eq } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { latestScores, scores } from "../schema.js";

export type NewScore = typeof scores.$inferInsert;

export function createScoresRepo(db: AtlasDb) {
  return {
    async create(input: NewScore) {
      const [score] = await db
        .insert(scores)
        .values(input)
        .onConflictDoUpdate({
          target: [scores.entityType, scores.entityId, scores.scoreType, scores.inputsHash],
          set: {
            scoreValue: input.scoreValue,
            confidence: input.confidence,
            reasonsJson: input.reasonsJson,
            riskFlagsJson: input.riskFlagsJson,
            computedAt: input.computedAt,
            expiresAt: input.expiresAt
          }
        })
        .returning();
      return score;
    },

    async setLatest(score: typeof scores.$inferSelect) {
      const [latest] = await db
        .insert(latestScores)
        .values({
          entityType: score.entityType,
          entityId: score.entityId,
          scoreType: score.scoreType,
          scoreId: score.id,
          scoreValue: score.scoreValue,
          confidence: score.confidence,
          computedAt: score.computedAt
        })
        .onConflictDoUpdate({
          target: [latestScores.entityType, latestScores.entityId, latestScores.scoreType],
          set: {
            scoreId: score.id,
            scoreValue: score.scoreValue,
            confidence: score.confidence,
            computedAt: score.computedAt
          }
        })
        .returning();

      return latest;
    },

    async listForEntity(entityType: string, entityId: string) {
      return db
        .select()
        .from(scores)
        .where(and(eq(scores.entityType, entityType), eq(scores.entityId, entityId)))
        .orderBy(desc(scores.computedAt));
    }
  };
}
