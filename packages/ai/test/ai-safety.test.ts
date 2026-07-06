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
    subject: { type: "card", id: "demo-card-001" },
    card: {
      tokenId: "demo-card-001",
      itemId: "item-001",
      name: "Pikachu PSA 10",
      normalizedName: "pikachu psa 10",
      setName: "Promo",
      cardNumber: "001",
      characterName: "Pikachu",
      tcg: "Pokemon",
      ownerAddress: "0x0000000000000000000000000000000000000001",
      ownerUsername: "demo",
      grader: "PSA",
      grade: "10",
      language: "English",
      year: 2024,
      serial: "12345678",
      serialNum: 12345678n,
      status: "listed",
      firstSeenAt: observedAt,
      lastSeenAt: observedAt
    },
    scores: [
      {
        entityType: "card",
        entityId: "demo-card-001",
        scoreType: "liquidity",
        scoreValue: 82,
        confidence: "high",
        inputsHash: "score-hash",
        reasons: ["Offer depth and listing health are strong."],
        riskFlags: [],
        computedAt: observedAt
      }
    ],
    candidateActions: [
      {
        subjectType: "card",
        subjectId: "demo-card-001",
        actionType: "WATCH",
        priority: 1,
        title: "Watch card",
        reason: "Deterministic scores support monitoring the card before taking any collector action.",
        confidence: "medium",
        risks: [],
        sourceIds: ["source:demo-card-001"]
      }
    ],
    sources: [
      {
        id: "source:demo-card-001",
        source: "manual_seed",
        fetchedAt: observedAt,
        confidence: "medium"
      },
      {
        id: "score:demo-card-001:liquidity",
        source: "manual_seed",
        fetchedAt: observedAt,
        confidence: "high"
      }
    ],
    riskFlags: [],
    freshness: [{ source: "manual_seed", observedAt, status: "fresh" }],
    mockData: false,
    ...overrides
  };
}

describe("AI memo safety", () => {
  it("rejects uncited sources from model output", () => {
    const result = validateAiMemoOutput(
      {
        recommendation: "Watch the card while evidence develops.",
        evidence: ["Liquidity score is strong."],
        risks: ["No major deterministic risk flags are present."],
        confidence: "medium",
        sourcesUsed: ["unknown-source"],
        nextAction: { label: "Watch card", type: "WATCH" },
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
        sourcesUsed: ["source:demo-card-001"],
        nextAction: { label: "Watch card", type: "WATCH" },
        disclaimer: "Informational only; verify cited sources before acting."
      },
      memoInput()
    );

    expect(result.success).toBe(false);
    expect(result.issues.join(",")).toContain("prohibited_phrases");
  });

  it("caps confidence for mock data", () => {
    expect(
      confidenceCapForInput(
        memoInput({
          mockData: true,
          riskFlags: ["mock_data"]
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
          sourcesUsed: ["source:demo-card-001"],
          nextAction: { label: "Watch card", type: "WATCH" },
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
    expect(result.output.sourcesUsed).toContain("source:demo-card-001");
    expect(result.safetyIssues.join(",")).toContain("prohibited_phrases");
  });

  it("hashes bigint serial evidence deterministically", () => {
    expect(hashAiMemoInput(memoInput())).toHaveLength(64);
    expect(hashAiMemoInput(memoInput())).toBe(hashAiMemoInput(memoInput()));
  });
});
