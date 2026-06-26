import { and, asc, eq } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { actionRecommendations } from "../schema.js";

export type NewActionRecommendation = typeof actionRecommendations.$inferInsert;

export function createActionsRepo(db: AtlasDb) {
  return {
    async create(input: NewActionRecommendation) {
      const [action] = await db.insert(actionRecommendations).values(input).returning();
      return action;
    },

    async listForSubject(subjectType: string, subjectId: string) {
      return db
        .select()
        .from(actionRecommendations)
        .where(
          and(
            eq(actionRecommendations.subjectType, subjectType),
            eq(actionRecommendations.subjectId, subjectId)
          )
        )
        .orderBy(asc(actionRecommendations.priority));
    }
  };
}
