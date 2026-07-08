import type { AiMemoInput } from "./schemas.js";

const scoreDisplayNames: Record<string, string> = {
  activity_velocity: "recent market activity",
  liquidity: "liquidity signal",
  deal: "memo readiness",
  price_confidence: "FMV confidence"
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

function buildEvidenceDigest(input: AiMemoInput): Record<string, unknown> {
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
  "Use only the structured Renaiss API data supplied by Atlas. Do not browse, infer hidden facts, invent data, or imply Atlas has another price feed.",
  "Low confidence means the available Renaiss records are thin or stale, not that another data source disagrees.",
  "Write for a collector deciding what to inspect next. Do not give buy/sell instructions, guaranteed upside, price predictions, custody advice, lending advice, or execution steps.",
  "Return exactly one JSON object matching the requested schema. Do not include markdown, prose outside JSON, or extra keys.",
  "sourcesUsed must contain only Renaiss citation IDs supplied in allowedSourceIds, and every recommendation must be grounded in those IDs.",
  "If data is thin, stale, or missing recent trades, say that plainly and keep confidence low or medium.",
  "The disclaimer must include the word Informational."
].join("\n");

export function buildCardMemoUserPrompt(input: AiMemoInput): string {
  return [
    "Create an AI Deal Memo from this Renaiss data.",
    "Output schema:",
    JSON.stringify(
      {
        recommendation: "1-3 sentences. Explain the next inspection decision, not a trade command.",
        evidence: [
          "3-5 bullets. Use concrete Renaiss data: confidence, recent trades, FMV history, last sale recency, and score meanings."
        ],
        risks: [
          "2-5 bullets. Include thin data, stale/missing sale data, or missing trades when present."
        ],
        confidence: "low | medium | high; never exceed what the evidence supports",
        sourcesUsed: ["Only Renaiss citation IDs from evidenceDigest.allowedSourceIds"],
        nextAction: {
          label: "Use one of: Review Renaiss data, Compare recent trades, Monitor until data improves",
          type: "REVIEW_SOURCES"
        },
        disclaimer:
          "Informational only; Atlas does not request keys, approvals, custody, lending, or trade execution. Verify cited Renaiss data before acting."
      },
      null,
      2
    ),
    "Writing rules:",
    "- Never say Atlas used SNKRDUNK, PriceCharting, wallet data, mock demand, external comps, or marketplace connectors.",
    "- Do not mention source counts, observation windows, source breakdowns, or upstream evidence feeds.",
    "- Do not repeat a score name by itself; explain what it means in collector terms.",
    "- If confidence is low or medium, describe why the memo is cautious.",
    "- Keep the recommendation useful even when confidence is low: tell the collector what evidence to review next.",
    "Evidence digest:",
    JSON.stringify(jsonSafe(buildEvidenceDigest(input)), null, 2)
  ].join("\n\n");
}
