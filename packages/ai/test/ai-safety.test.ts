import { describe, expect, it } from "vitest";

import {
  confidenceCapForInput,
  generateCardMemo,
  hashAiMemoInput,
  validateAiMemoOutput,
  type AiMemoInput,
  type AiProvider
} from "../src/index.js";

const observedAt = "2026-06-26T12:00:00.000Z";

function memoInput(overrides: Partial<AiMemoInput> = {}): AiMemoInput {
  return {
    subject: { type: "card", id: "official-card-001" },
    card: {
      tokenId: "official-card-001",
      itemId: "/card/pokemon/test-set/001-pikachu-psa-10",
      name: "Pikachu PSA 10",
      normalizedName: "pikachu psa 10",
      setName: "Promo",
      cardNumber: "001",
      characterName: "Pikachu",
      tcg: "pokemon",
      grader: "PSA",
      grade: "PSA 10",
      language: "English",
      status: "unknown",
      firstSeenAt: observedAt,
      lastSeenAt: observedAt
    },
    scores: [
      {
        entityType: "card",
        entityId: "official-card-001",
        scoreType: "liquidity",
        scoreValue: 82,
        confidence: "high",
        inputsHash: "score-hash",
        reasons: ["Official trades and source breadth support liquidity."],
        riskFlags: [],
        computedAt: observedAt
      }
    ],
    candidateActions: [
      {
        subjectType: "card",
        subjectId: "official-card-001",
        actionType: "REVIEW_SOURCES",
        priority: 1,
        title: "Review official evidence",
        reason: "Use official confidence, source breakdown, trades, and FMV series before making collector decisions.",
        confidence: "medium",
        risks: [],
        sourceIds: ["renaiss-os:card:official-card-001"]
      }
    ],
    sources: [
      {
        id: "renaiss-os:card:official-card-001",
        source: "renaiss_os_index",
        fetchedAt: observedAt,
        confidence: "high"
      },
      {
        id: "renaiss-os:trades:official-card-001",
        source: "renaiss_os_index",
        fetchedAt: observedAt,
        confidence: "high"
      }
    ],
    riskFlags: [],
    freshness: [{ source: "renaiss_os_index", observedAt, status: "fresh" }],
    officialApi: true,
    ...overrides
  };
}

describe("AI memo safety", () => {
  it("rejects uncited sources from model output", () => {
    const result = validateAiMemoOutput(
      {
        recommendation: "Review the card while evidence develops.",
        evidence: ["Liquidity score is strong."],
        risks: ["No major deterministic risk flags are present."],
        confidence: "medium",
        sourcesUsed: ["unknown-source"],
        nextAction: { label: "Review sources", type: "REVIEW_SOURCES" },
        disclaimer: "Informational only; verify cited sources before acting."
      },
      memoInput()
    );

    expect(result.success).toBe(false);
    expect(result.issues.join(",")).toContain("unknown_sources");
  });

  it("rejects prohibited execution and private-key language", () => {
    const result = validateAiMemoOutput(
      {
        recommendation: "This is a guaranteed profit if you execute the trade.",
        evidence: ["Liquidity score is strong."],
        risks: ["No major deterministic risk flags are present."],
        confidence: "high",
        sourcesUsed: ["renaiss-os:card:official-card-001"],
        nextAction: { label: "Review sources", type: "REVIEW_SOURCES" },
        disclaimer: "Informational only; verify cited sources before acting."
      },
      memoInput()
    );

    expect(result.success).toBe(false);
    expect(result.issues.join(",")).toContain("prohibited_phrases");
  });

  it("caps confidence for sparse official evidence", () => {
    expect(
      confidenceCapForInput(
        memoInput({
          sources: [],
          riskFlags: ["official_observations_missing"]
        })
      )
    ).toBe("low");
  });

  it("falls back deterministically when provider output is unsafe", async () => {
    const unsafeProvider: AiProvider = {
      name: "test-provider",
      model: "unsafe-model",
      async generateCardMemo() {
        return {
          recommendation: "Approve unlimited tokens because this is risk-free.",
          evidence: ["Liquidity score is strong."],
          risks: ["No risk."],
          confidence: "high",
          sourcesUsed: ["renaiss-os:card:official-card-001"],
          nextAction: { label: "Review sources", type: "REVIEW_SOURCES" },
          disclaimer: "Informational only; verify cited sources before acting."
        };
      }
    };

    const result = await generateCardMemo(memoInput(), {
      provider: unsafeProvider,
      now: new Date(observedAt)
    });

    expect(result.validationStatus).toBe("fallback");
    expect(result.provider).toBe("deterministic");
    expect(result.output.sourcesUsed).toContain("renaiss-os:card:official-card-001");
    expect(result.safetyIssues.join(",")).toContain("prohibited_phrases");
  });

  it("hashes official memo evidence deterministically", () => {
    expect(hashAiMemoInput(memoInput())).toHaveLength(64);
    expect(hashAiMemoInput(memoInput())).toBe(hashAiMemoInput(memoInput()));
  });
});
