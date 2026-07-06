import { createHash } from "node:crypto";

import { AiMemoInputSchema } from "@renaiss/core";

import { createDeterministicCardMemo } from "./fallback.js";
import { buildCardMemoProviderRequest, createAiProviderFromEnv, type AiProvider } from "./providers.js";
import { capMemoConfidence, validateAiMemoOutput } from "./safety.js";
import type { AiCardMemoResult, AiMemoInput, AiMemoOutput } from "./schemas.js";

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

function fallbackResult(input: {
  parsedInput: AiMemoInput;
  inputHash: string;
  issues: string[];
  now: Date;
}): AiCardMemoResult {
  const capped = capMemoConfidence({
    memo: createDeterministicCardMemo(input.parsedInput),
    evidence: input.parsedInput
  });

  return {
    subject: input.parsedInput.subject,
    provider: "deterministic",
    model: "atlas-fallback",
    inputHash: input.inputHash,
    output: capped.memo,
    validationStatus: "fallback",
    sourceIds: capped.memo.sourcesUsed,
    safetyIssues: [...input.issues, ...capped.issues],
    createdAt: input.now.toISOString(),
    deterministicFallback: true
  };
}

export async function generateCardMemo(input: unknown, options: {
  provider?: AiProvider | null;
  env?: Record<string, string | undefined>;
  now?: Date;
} = {}): Promise<AiCardMemoResult> {
  const parsedInput = AiMemoInputSchema.parse(input);
  const now = options.now ?? new Date();
  const inputHash = hashAiMemoInput(parsedInput);
  const provider = options.provider === undefined ? createAiProviderFromEnv(options.env) : options.provider;

  if (provider == null) {
    return fallbackResult({
      parsedInput,
      inputHash,
      issues: ["provider_unavailable"],
      now
    });
  }

  let output: unknown;
  try {
    output = await provider.generateCardMemo(buildCardMemoProviderRequest(parsedInput));
  } catch (error) {
    return fallbackResult({
      parsedInput,
      inputHash,
      issues: [error instanceof Error ? `provider_error:${error.message}` : "provider_error"],
      now
    });
  }

  const validated = validateAiMemoOutput(output, parsedInput);
  if (!validated.success) {
    return fallbackResult({
      parsedInput,
      inputHash,
      issues: validated.issues,
      now
    });
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
    createdAt: now.toISOString(),
    deterministicFallback: false
  };
}
