import type { AtlasDb } from "../client.js";
import { discordEvents } from "../schema.js";

export type NewDiscordEvent = typeof discordEvents.$inferInsert;

export function createDiscordEventsRepo(db: AtlasDb) {
  return {
    async create(input: NewDiscordEvent) {
      const [event] = await db.insert(discordEvents).values(input).returning();
      return event;
    }
  };
}
