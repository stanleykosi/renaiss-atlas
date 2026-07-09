import type { AiMemoInput } from "./schemas.js";

const scoreDisplayNames: Record<string, string> = {
  activity_velocity: "market activity",
  liquidity: "liquidity",
  price_confidence: "FMV reliability"
};

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

function riskDisplayName(value: string): string {
  if (value === "official_confidence_low") return "low confidence";
  if (value === "stale_last_sale") return "stale last sale";
  if (value === "trade_activity_missing") return "missing recent trades";
  return value.replaceAll("_", " ");
}

function buildRenaissSignalDigest(input: AiMemoInput): Record<string, unknown> {
  return {
    card: {
      name: input.card.name,
      setName: input.card.setName ?? null,
      grade: input.card.grade ?? null,
      language: input.card.language ?? null
    },
    renaissData: input.officialEvidence,
    atlasScores: input.scores.map((score) => ({
      name: scoreDisplayNames[score.scoreType] ?? score.scoreType,
      score: score.scoreValue,
      confidence: score.confidence,
      reason: score.reasons[0] ?? null,
      riskFlags: score.riskFlags
        .filter((flag) => flag !== "single_source_evidence" && flag !== "official_observations_missing")
        .map(riskDisplayName)
    })),
    freshness: input.freshness,
    riskFlags: input.riskFlags
      .filter((flag) => flag !== "single_source_evidence" && flag !== "official_observations_missing")
      .map(riskDisplayName),
    allowedSourceIds: input.sources.map((source) => source.id)
  };
}

export const CARD_MEMO_SYSTEM_PROMPT = [
  "You are Renaiss Atlas, a read-only collector intelligence copilot for Renaiss marketplace cards.",
  "Your job is to make a clear collector call from Renaiss data and deterministic Atlas scores.",
  "Use only the structured Renaiss API data supplied by Atlas. Do not browse, infer hidden facts, invent data, or imply Atlas has another price feed.",
  "Low confidence means the available Renaiss records are thin or stale, not that another data source disagrees.",
  "Write for a collector who wants a next move: pursue now, wait, pass for now, cap price exposure, skip stretched listings, or prioritize fresher opportunities.",
  "When priceAction is present, use it to set a practical price posture around FMV, latest trade, and the recent trade range.",
  "When confidence is low, still make a call; the call should become wait or pass for now instead of asking the collector to do more analysis.",
  "Stay read-only: no guaranteed upside, price predictions, custody advice, lending advice, signatures, token approvals, or execution steps.",
  "Return exactly one JSON object matching the requested schema. Do not include markdown, prose outside JSON, or extra keys.",
  "sourcesUsed must contain only Renaiss citation IDs supplied in allowedSourceIds, and every recommendation must be grounded in those IDs.",
  "Thin, stale, or missing data should change the action call and confidence, not produce a vague caution.",
  "Avoid boilerplate. The first sentence must tell the collector what to do.",
  "The disclaimer must include the word Informational."
].join("\n");

export function buildCardMemoUserPrompt(input: AiMemoInput): string {
  return [
    "Create a Collector Brief from this Renaiss data.",
    "Output schema:",
    JSON.stringify(
      {
        recommendation:
          "Action call. 1-3 direct sentences. Start with one of: Pursue now, Wait, Pass for now, or Cap exposure. Include a concrete price posture when priceAction supports it.",
        evidence: [
          "Why this call. 2-4 distinct bullets using concrete Renaiss data: confidence, recent trades, FMV history, last-sale recency, priceAction, and what Atlas scores imply."
        ],
        risks: [
          "Action limits. 1-4 guardrails that say what to avoid or where to stop: stretched price, stale sale, missing trades, thin confidence, or weak FMV support."
        ],
        confidence: "low | medium | high; never exceed what the evidence supports",
        sourcesUsed: ["Only Renaiss citation IDs from renaissSignalDigest.allowedSourceIds"],
        nextAction: {
          label: "Use one of: Pursue near FMV, Wait for better entry, Pass for now, Cap exposure",
          type: "REVIEW_SOURCES"
        },
        disclaimer:
          "Informational only; Atlas does not request keys, approvals, custody, lending, or trade execution."
      },
      null,
      2
    ),
    "Writing rules:",
    "- Never say Atlas used SNKRDUNK, PriceCharting, wallet data, mock demand, external comps, or marketplace connectors.",
    "- Make one decisive call in the recommendation; evidence and risks should support that call rather than reopen the decision.",
    "- Use concrete collector language: pursue, wait, pass, cap, skip, prioritize, hold off.",
    "- Use priceAction numbers when available. Example patterns: 'pursue only near or under $X', 'skip listings above $Y', 'wait for a sale closer to $Z'.",
    "- For prime/high confidence and strong scores, the read should be more assertive. For low confidence, the action should be wait or pass for now.",
    "- Keep each line useful. Do not repeat a score name or value unless you explain the action consequence.",
    "Renaiss signal digest:",
    JSON.stringify(jsonSafe(buildRenaissSignalDigest(input)), null, 2)
  ].join("\n\n");
}
