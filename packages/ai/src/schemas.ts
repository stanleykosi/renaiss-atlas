import {
  AiMemoOfficialEvidenceSchema,
  AiMemoInputSchema,
  AiMemoOutputSchema,
  type AiMemoOfficialEvidence,
  type AiMemoInput,
  type AiMemoOutput
} from "@renaiss/core";
import { z } from "zod";

export { AiMemoInputSchema, AiMemoOfficialEvidenceSchema, AiMemoOutputSchema };

const AiMemoValidationStatusSchema = z.literal("validated");

export const AiCardMemoResultSchema = z.object({
  subject: AiMemoInputSchema.shape.subject,
  provider: z.string().min(1),
  model: z.string().min(1),
  inputHash: z.string().min(16),
  output: AiMemoOutputSchema,
  validationStatus: AiMemoValidationStatusSchema,
  sourceIds: z.array(z.string().min(1)).min(1),
  safetyIssues: z.array(z.string().min(1)),
  createdAt: z.string().datetime()
});

export type { AiMemoInput, AiMemoOfficialEvidence, AiMemoOutput };
export type AiCardMemoResult = z.infer<typeof AiCardMemoResultSchema>;
