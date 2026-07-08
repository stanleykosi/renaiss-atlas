import { createHash } from "node:crypto";

import { AiMemoInputSchema } from "@renaiss/core";

import { buildCardMemoProviderRequest, createAiProviderFromEnv, type AiProvider } from "./providers.js";
import { validateAiMemoOutput } from "./safety.js";
import type { AiCardMemoResult, AiMemoInput, AiMemoOutput } from "./schemas.js";

export class AiMemoGenerationError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[]) {
    super(`${message} ${issues.join("; ")}`);
    this.name = "AiMemoGenerationError";
    this.issues = issues;
  }
}

function stableStringify(value: unknown): string {
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  return `{${entries
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
    .join(",")}}`;
}

export function hashAiMemoInput(input: AiMemoInput): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}

export async function generateCardMemo(input: unknown, options: {
  provider?: AiProvider;
  env?: Record<string, string | undefined>;
  now?: Date;
} = {}): Promise<AiCardMemoResult> {
  const parsedInput = AiMemoInputSchema.parse(input);
  const now = options.now ?? new Date();
  const inputHash = hashAiMemoInput(parsedInput);
  let provider: AiProvider;
  try {
    provider = options.provider ?? createAiProviderFromEnv(options.env);
  } catch (error) {
    const issue = error instanceof Error ? `provider_config_error:${error.message}` : "provider_config_error";
    throw new AiMemoGenerationError("OpenRouter is not configured correctly.", [issue]);
  }

  let output: unknown;
  try {
    output = await provider.generateCardMemo(buildCardMemoProviderRequest(parsedInput));
  } catch (error) {
    const issue = error instanceof Error ? `provider_error:${error.message}` : "provider_error";
    throw new AiMemoGenerationError("OpenRouter memo generation failed.", [issue]);
  }

  const validated = validateAiMemoOutput(output, parsedInput);
  if (!validated.success) {
    throw new AiMemoGenerationError("OpenRouter memo output failed Atlas safety validation.", validated.issues);
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
