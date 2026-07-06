import type { ActionType, Score } from "@renaiss/core";

import type { AiMemoInput, AiMemoOutput } from "./schemas.js";

function formatScore(score: Score): string {
  return `${score.scoreType.replaceAll("_", " ")} score is ${score.scoreValue.toFixed(0)} (${score.confidence}).`;
}

function topScores(scores: Score[]): Score[] {
  return [...scores].sort((left, right) => right.scoreValue - left.scoreValue).slice(0, 3);
}

function primarySourceIds(input: AiMemoInput): string[] {
  return input.sources.slice(0, 4).map((source) => source.id);
}

function chooseAction(input: AiMemoInput): { label: string; type: ActionType } {
  const firstAction = [...input.candidateActions].sort((left, right) => left.priority - right.priority)[0];
  if (firstAction != null) {
    return {
      label: firstAction.cta?.label ?? firstAction.title,
      type: firstAction.actionType
    };
  }

  if (input.riskFlags.includes("external_comp_mismatch")) {
    return { label: "Review evidence", type: "WATCH" };
  }

  if (input.subject.type === "card") {
    return { label: "Watch card", type: "WATCH" };
  }

  return { label: "Review sources", type: "WATCH" };
}

export function createDeterministicCardMemo(input: AiMemoInput): AiMemoOutput {
  const subjectLabel = input.card?.name ?? input.subject.id;
  const sourceIds = primarySourceIds(input);
  const scoreEvidence = topScores(input.scores).map(formatScore);
  const action = chooseAction(input);
  const actionReason = [...input.candidateActions].sort((left, right) => left.priority - right.priority)[0]?.reason;
  const evidence = [
    `${subjectLabel} is evaluated from ${sourceIds.length} cited source${sourceIds.length === 1 ? "" : "s"}.`,
    ...scoreEvidence,
    ...(actionReason == null ? [] : [actionReason])
  ].slice(0, 6);
  const freshnessRisks = input.freshness
    .filter((freshness) => freshness.status !== "fresh")
    .map((freshness) => `${freshness.source} freshness is ${freshness.status}.`);
  const riskFlags = input.riskFlags.map((flag) => flag.replaceAll("_", " "));
  const risks = [
    ...(input.mockData ? ["Mock data is labeled and must be verified against live sources."] : []),
    ...freshnessRisks,
    ...riskFlags
  ].slice(0, 6);

  return {
    recommendation:
      actionReason ??
      `Monitor ${subjectLabel} until cited sources provide enough confidence for a stronger collector action.`,
    evidence: evidence.length > 0 ? evidence : ["Atlas has limited cited evidence for this card."],
    risks: risks.length > 0 ? risks : ["No major deterministic risk flags are present in the supplied evidence."],
    confidence: input.mockData || input.riskFlags.includes("mock_data") ? "low" : "medium",
    sourcesUsed: sourceIds,
    nextAction: action,
    disclaimer:
      "Informational only; Atlas does not request keys, approvals, custody, lending, or trade execution. Verify cited sources before acting."
  };
}
