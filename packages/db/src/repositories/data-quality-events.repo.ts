import { and, desc, eq } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { dataQualityEvents } from "../schema.js";

export type NewDataQualityEvent = typeof dataQualityEvents.$inferInsert;

export function createDataQualityEventsRepo(db: AtlasDb) {
  return {
    async create(input: NewDataQualityEvent) {
      const [event] = await db.insert(dataQualityEvents).values(input).returning();
      return event;
    },

    async listForEntity(entityType: string, entityId: string, limit = 50) {
      return db
        .select()
        .from(dataQualityEvents)
        .where(
          and(eq(dataQualityEvents.entityType, entityType), eq(dataQualityEvents.entityId, entityId))
        )
        .orderBy(desc(dataQualityEvents.createdAt))
        .limit(limit);
    },

    async recent(limit = 50, severity?: string) {
      const query = db.select().from(dataQualityEvents).orderBy(desc(dataQualityEvents.createdAt)).limit(limit);
      if (severity == null) return query;
      return db
        .select()
        .from(dataQualityEvents)
        .where(eq(dataQualityEvents.severity, severity))
        .orderBy(desc(dataQualityEvents.createdAt))
        .limit(limit);
    }
  };
}
