import {
  ActionTypeSchema,
  AiMemoInputSchema,
  AiMemoOutputSchema,
  type AiMemoInput,
  type AiMemoOutput
} from "@renaiss/core";
import { z } from "zod";

export const AiActionTypeSchema = ActionTypeSchema;

export { AiMemoInputSchema, AiMemoOutputSchema };

export const AiMemoValidationStatusSchema = z.enum(["validated", "fallback", "rejected"]);

export const AiCardMemoResultSchema = z.object({
  subject: AiMemoInputSchema.shape.subject,
  provider: z.string().min(1),
  model: z.string().min(1),
  inputHash: z.string().min(16),
  output: AiMemoOutputSchema,
  validationStatus: AiMemoValidationStatusSchema,
  sourceIds: z.array(z.string().min(1)).min(1),
  safetyIssues: z.array(z.string().min(1)),
  createdAt: z.string().datetime(),
  deterministicFallback: z.boolean()
});

export type { AiMemoInput, AiMemoOutput };
export type AiMemoValidationStatus = z.infer<typeof AiMemoValidationStatusSchema>;
export type AiCardMemoResult = z.infer<typeof AiCardMemoResultSchema>;
