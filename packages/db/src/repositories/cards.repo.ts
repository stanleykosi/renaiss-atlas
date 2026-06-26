import { desc, eq } from "drizzle-orm";

import type { AtlasDb } from "../client.js";
import { cards } from "../schema.js";

export type NewCard = typeof cards.$inferInsert;

export function createCardsRepo(db: AtlasDb) {
  return {
    async insert(input: NewCard) {
      const [card] = await db.insert(cards).values(input).returning();
      return card;
    },

    async upsert(input: NewCard) {
      const [card] = await db
        .insert(cards)
        .values(input)
        .onConflictDoUpdate({
          target: cards.tokenId,
          set: {
            itemId: input.itemId,
            name: input.name ?? "",
            normalizedName: input.normalizedName ?? "",
            setName: input.setName ?? "",
            normalizedSetName: input.normalizedSetName ?? "",
            cardNumber: input.cardNumber ?? "",
            characterName: input.characterName ?? "",
            normalizedCharacterName: input.normalizedCharacterName ?? "",
            tcg: input.tcg ?? "",
            ownerAddress: input.ownerAddress,
            ownerUsername: input.ownerUsername,
            vaultLocation: input.vaultLocation,
            grader: input.grader,
            grade: input.grade,
            language: input.language,
            year: input.year,
            serial: input.serial,
            serialNum: input.serialNum,
            imageUrl: input.imageUrl,
            status: input.status,
            lastSeenAt: input.lastSeenAt ?? new Date(),
            lastSourceRecordId: input.lastSourceRecordId,
            metadata: input.metadata
          }
        })
        .returning();

      return card;
    },

    async findByTokenId(tokenId: string) {
      const [card] = await db.select().from(cards).where(eq(cards.tokenId, tokenId)).limit(1);
      return card;
    },

    async listByOwner(ownerAddress: string) {
      return db
        .select()
        .from(cards)
        .where(eq(cards.ownerAddress, ownerAddress))
        .orderBy(desc(cards.lastSeenAt));
    }
  };
}

