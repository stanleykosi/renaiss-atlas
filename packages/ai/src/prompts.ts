import type { AiMemoInput } from "./schemas.js";

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value != null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, jsonSafe(nested)])
    );
  }
  return value;
}

export const CARD_MEMO_SYSTEM_PROMPT = [
  "You are Renaiss Atlas, a source-aware collector copilot for liquidity analysis.",
  "Use only the structured evidence supplied by Atlas. Do not browse, infer hidden facts, or invent sources.",
  "Return one JSON object matching the requested schema exactly.",
  "Every recommendation must cite source IDs from the supplied sourcesUsed list.",
  "Never request private keys, seed phrases, wallet signatures, token approvals, custody, lending execution, or trade execution.",
  "Keep language informational and cautious. Mention mock or stale data when present."
].join("\n");

export function buildCardMemoUserPrompt(input: AiMemoInput): string {
  return [
    "Create a concise card memo from this validated evidence.",
    "Schema fields: recommendation, evidence, risks, confidence, sourcesUsed, nextAction, disclaimer.",
    "Use 1-6 evidence bullets, 1-6 risk bullets, and only source IDs present in sources.",
    JSON.stringify(jsonSafe(input), null, 2)
  ].join("\n\n");
}
