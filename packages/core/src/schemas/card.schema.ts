import { z } from "zod";

export const CardStatusSchema = z.enum(["listed", "unlisted", "unknown"]);

export const CardSchema = z.object({
  tokenId: z.string().min(1),
  itemId: z.string().nullable().optional(),
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  setName: z.string().nullable().optional(),
  cardNumber: z.string().nullable().optional(),
  characterName: z.string().nullable().optional(),
  tcg: z.string().nullable().optional(),
  ownerAddress: z.string().nullable().optional(),
  ownerUsername: z.string().nullable().optional(),
  vaultLocation: z.string().nullable().optional(),
  grader: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  year: z.number().int().min(1800).max(2200).nullable().optional(),
  serial: z.string().nullable().optional(),
  serialNum: z.bigint().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  status: CardStatusSchema,
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime()
});

export const CardListItemSchema = CardSchema.pick({
  tokenId: true,
  itemId: true,
  name: true,
  setName: true,
  cardNumber: true,
  characterName: true,
  imageUrl: true,
  grader: true,
  grade: true,
  language: true,
  year: true,
  serial: true,
  status: true
}).extend({
  askPriceUsd: z.number().nonnegative().optional(),
  fmvUsd: z.number().nonnegative().optional(),
  topOfferUsd: z.number().nonnegative().optional(),
  lastSaleUsd: z.number().nonnegative().optional(),
  liquidityScore: z.number().min(0).max(100).optional(),
  dealScore: z.number().min(0).max(100).optional(),
  demandScore: z.number().min(0).max(100).optional(),
  recommendedAction: z.string().optional()
});

export type CardStatus = z.infer<typeof CardStatusSchema>;
export type Card = z.infer<typeof CardSchema>;
export type CardListItem = z.infer<typeof CardListItemSchema>;

