import { desc, eq } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { sourceRecords } from "../schema.js";

export type NewSourceRecord = typeof sourceRecords.$inferInsert;

export function createSourceRecordsRepo(db: AtlasDb) {
  return {
    async create(input: NewSourceRecord) {
      const [record] = await db.insert(sourceRecords).values(input).returning();
      return record;
    },

    async findById(id: string) {
      const [record] = await db.select().from(sourceRecords).where(eq(sourceRecords.id, id)).limit(1);
      return record;
    },

    async latest(limit = 20) {
      return db.select().from(sourceRecords).orderBy(desc(sourceRecords.fetchedAt)).limit(limit);
    }
  };
}

