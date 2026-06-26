import { z } from "zod";

export const AiActionTypeSchema = z.enum([
  "LIST",
  "MAKE_OFFER",
  "BUNDLE",
  "WATCH",
  "AVOID",
  "CREATE_INTENT",
  "MATCH_INTENT",
  "QUEST",
  "SHARE"
]);

export const AiMemoOutputSchema = z.object({
  recommendation: z.string().min(1).max(600),
  evidence: z.array(z.string().min(1).max(280)).min(1).max(6),
  risks: z.array(z.string().min(1).max(280)).min(1).max(6),
  confidence: z.enum(["low", "medium", "high"]),
  sourcesUsed: z.array(z.string().min(1)).min(1),
  nextAction: z.object({
    label: z.string().min(1).max(80),
    type: AiActionTypeSchema
  }),
  disclaimer: z.string().min(1).max(300)
});

export const PROHIBITED_AI_PHRASES = [
  "guaranteed profit",
  "risk-free",
  "official Renaiss recommendation",
  "will definitely",
  "loan approved",
  "collateral value is guaranteed",
  "send your private key",
  "seed phrase",
  "approve unlimited"
] as const;

export type AiMemoOutput = z.infer<typeof AiMemoOutputSchema>;
