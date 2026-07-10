import { AiMemoInputSchema, hashPayload } from "@renaiss/core";

import {
  buildCardMemoProviderRequest,
  createAiProviderFromEnv,
  type AiProvider
} from "./providers.js";
import { validateAiMemoOutput } from "./safety.js";
import type { AiCardMemoResult, AiMemoInput, AiMemoOutput } from "./schemas.js";

export class AiMemoGenerationError extends Error {
  readonly issues: string[];
  readonly publicMessage: string;

  constructor(message: string, issues: string[], options?: ErrorOptions) {
    super(`${message} ${issues.join("; ")}`, options);
    this.name = "AiMemoGenerationError";
    this.issues = issues;
    this.publicMessage = message;
  }
}

export function hashAiMemoInput(input: AiMemoInput): string {
  return hashPayload(input);
}

export async function generateCardMemo(
  input: unknown,
  options: {
    provider?: AiProvider;
    env?: Record<string, string | undefined>;
    now?: Date;
  } = {}
): Promise<AiCardMemoResult> {
  const parsedInput = AiMemoInputSchema.parse(input);
  const now = options.now ?? new Date();
  const inputHash = hashAiMemoInput(parsedInput);
  let provider: AiProvider;
  try {
    provider = options.provider ?? createAiProviderFromEnv(options.env);
  } catch (error) {
    const issue =
      error instanceof Error ? `provider_config_error:${error.message}` : "provider_config_error";
    throw new AiMemoGenerationError("OpenRouter is not configured correctly.", [issue], {
      cause: error
    });
  }

  let output: unknown;
  try {
    output = await provider.generateCardMemo(buildCardMemoProviderRequest(parsedInput));
  } catch (error) {
    const issue = error instanceof Error ? `provider_error:${error.message}` : "provider_error";
    throw new AiMemoGenerationError("OpenRouter memo generation failed.", [issue], {
      cause: error
    });
  }

  const validated = validateAiMemoOutput(output, parsedInput);
  if (!validated.success) {
    throw new AiMemoGenerationError(
      "OpenRouter memo output failed Atlas safety validation.",
      validated.issues
    );
  }

  const memo: AiMemoOutput = validated.memo;

  return {
    subject: parsedInput.subject,
    provider: provider.name,
    model: provider.model,
    inputHash,
    output: memo,
    validationStatus: "validated",
    sourceIds: memo.sourcesUsed,
    safetyIssues: validated.issues,
    createdAt: now.toISOString()
  };
}
