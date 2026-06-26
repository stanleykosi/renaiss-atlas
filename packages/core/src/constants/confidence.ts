import { z } from "zod";

export const CONFIDENCE_LABELS = ["low", "medium", "high"] as const;

export const ConfidenceLabelSchema = z.enum(CONFIDENCE_LABELS);

export type ConfidenceLabel = z.infer<typeof ConfidenceLabelSchema>;

export function confidenceRank(confidence: ConfidenceLabel): number {
  return CONFIDENCE_LABELS.indexOf(confidence);
}

export function minConfidence(
  first: ConfidenceLabel,
  second: ConfidenceLabel
): ConfidenceLabel {
  return confidenceRank(first) <= confidenceRank(second) ? first : second;
}
