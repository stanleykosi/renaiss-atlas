import { minConfidence, type ConfidenceLabel } from "@renaiss/core";

import { AiMemoOutputSchema, type AiMemoInput, type AiMemoOutput } from "./schemas.js";

export const PROHIBITED_AI_PHRASES = [
  "guaranteed profit",
  "risk-free",
  "official Renaiss recommendation",
  "will definitely",
  "loan approved",
  "collateral value is guaranteed",
  "send your private key",
  "seed phrase",
  "approve unlimited",
  "token approval",
  "approve tokens",
  "sign this transaction",
  "execute the trade",
  "trade execution",
  "custody your card",
  "custody your wallet"
] as const;

const HIGH_RISK_FLAGS = new Set([
  "mock_data",
  "external_comp_mismatch",
  "stale_renaiss_data",
  "external_comp_stale",
  "low_match_confidence",
  "activity_data_missing",
  "possible_stale_fmv",
  "price_outlier"
]);

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function memoText(memo: AiMemoOutput): string {
  return [
    memo.recommendation,
    ...memo.evidence,
    ...memo.risks,
    memo.nextAction.label,
    memo.nextAction.type,
    memo.disclaimer
  ].join("\n");
}

export function findProhibitedAiPhrases(value: string): string[] {
  const lower = value.toLowerCase();
  return PROHIBITED_AI_PHRASES.filter((phrase) => lower.includes(phrase.toLowerCase()));
}

export function confidenceCapForInput(input: AiMemoInput): ConfidenceLabel {
  let cap: ConfidenceLabel = "high";

  if (input.sources.length < 2) {
    cap = minConfidence(cap, "medium");
  }

  if (input.sources.length === 0 || input.mockData || input.riskFlags.includes("mock_data")) {
    cap = minConfidence(cap, "low");
  }

  if (input.freshness.some((freshness) => freshness.status === "stale" || freshness.status === "missing")) {
    cap = minConfidence(cap, "medium");
  }

  if (input.riskFlags.some((flag) => HIGH_RISK_FLAGS.has(flag))) {
    cap = minConfidence(cap, input.riskFlags.includes("mock_data") ? "low" : "medium");
  }

  return cap;
}

export function capMemoConfidence(input: {
  memo: AiMemoOutput;
  evidence: AiMemoInput;
}): { memo: AiMemoOutput; issues: string[] } {
  const cap = confidenceCapForInput(input.evidence);
  const cappedConfidence = minConfidence(input.memo.confidence, cap);
  const issues =
    cappedConfidence === input.memo.confidence
      ? []
      : [`confidence_capped:${input.memo.confidence}_to_${cappedConfidence}`];

  const riskNotes = [...input.memo.risks];
  if (input.evidence.mockData && !riskNotes.some((risk) => risk.toLowerCase().includes("mock"))) {
    riskNotes.push("Mock data is labeled and must be verified against live sources.");
  }
  if (
    input.evidence.freshness.some((freshness) => freshness.status === "stale") &&
    !riskNotes.some((risk) => risk.toLowerCase().includes("stale"))
  ) {
    riskNotes.push("At least one cited source is stale.");
  }

  return {
    memo: {
      ...input.memo,
      confidence: cappedConfidence,
      risks: unique(riskNotes).slice(0, 6)
    },
    issues
  };
}

export function validateAiMemoOutput(output: unknown, input: AiMemoInput):
  | { success: true; memo: AiMemoOutput; issues: string[] }
  | { success: false; issues: string[] } {
  const parsed = AiMemoOutputSchema.safeParse(output);
  if (!parsed.success) {
    return { success: false, issues: ["schema_validation_failed"] };
  }

  const allowedSources = new Set(input.sources.map((source) => source.id));
  const unknownSources = parsed.data.sourcesUsed.filter((sourceId) => !allowedSources.has(sourceId));
  const issues: string[] = [];

  if (unknownSources.length > 0) {
    issues.push(`unknown_sources:${unknownSources.join(",")}`);
  }

  const prohibited = findProhibitedAiPhrases(memoText(parsed.data));
  if (prohibited.length > 0) {
    issues.push(`prohibited_phrases:${prohibited.join(",")}`);
  }

  const disclaimer = parsed.data.disclaimer.toLowerCase();
  if (!disclaimer.includes("informational")) {
    issues.push("missing_informational_disclaimer");
  }

  if (issues.some((issue) => issue.startsWith("unknown_sources") || issue.startsWith("prohibited_phrases"))) {
    return { success: false, issues };
  }

  const capped = capMemoConfidence({ memo: parsed.data, evidence: input });
  return {
    success: true,
    memo: capped.memo,
    issues: [...issues, ...capped.issues]
  };
}
