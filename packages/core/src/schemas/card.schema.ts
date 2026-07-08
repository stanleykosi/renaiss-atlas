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
  grader: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  status: CardStatusSchema,
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime()
});

export type CardStatus = z.infer<typeof CardStatusSchema>;
export type Card = z.infer<typeof CardSchema>;
