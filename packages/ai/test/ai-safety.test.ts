import { describe, expect, it } from "vitest";

import {
  AiMemoGenerationError,
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
    officialEvidence: {
      confidence: "high",
      lastSaleAt: observedAt,
      updatedAt: observedAt,
      priceUsdCents: 125000,
      tradeCount: 4,
      transactionCount: 3,
      listingCount: 1,
      fmvPointCount: 6
    },
    scores: [
      {
        entityType: "card",
        entityId: "official-card-001",
        scoreType: "liquidity",
        scoreValue: 82,
        confidence: "high",
        inputsHash: "score-hash",
        reasons: ["Renaiss trades support liquidity."],
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
        title: "Compare card signals",
        reason: "Use Renaiss confidence, trades, and FMV history before making collector decisions.",
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

describe("Collector Brief safety", () => {
  it("rejects uncited sources from model output", () => {
    const result = validateAiMemoOutput(
      {
        recommendation: "Review the card while data develops.",
        evidence: ["Liquidity score is strong."],
        risks: ["No major deterministic risk flags are present."],
        confidence: "medium",
        sourcesUsed: ["unknown-source"],
        nextAction: { label: "Review sources", type: "REVIEW_SOURCES" },
        disclaimer: "Informational only; verify cited Renaiss data before acting."
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

  it("rejects memos that omit the informational disclaimer", () => {
    const result = validateAiMemoOutput(
      {
        recommendation: "Review the card while evidence develops.",
        evidence: ["Liquidity score is supported by Renaiss trades."],
        risks: ["Renaiss data can still be thin."],
        confidence: "medium",
        sourcesUsed: ["renaiss-os:card:official-card-001"],
        nextAction: { label: "Compare recent trades", type: "REVIEW_SOURCES" },
        disclaimer: "Verify cited sources before acting."
      },
      memoInput()
    );

    expect(result.success).toBe(false);
    expect(result.issues.join(",")).toContain("missing_informational_disclaimer");
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

  it("rejects provider output when it is unsafe", async () => {
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

    await expect(
      generateCardMemo(memoInput(), {
        provider: unsafeProvider,
        now: new Date(observedAt)
      })
    ).rejects.toMatchObject({
      name: "AiMemoGenerationError",
      issues: expect.arrayContaining([expect.stringContaining("prohibited_phrases")])
    } satisfies Partial<AiMemoGenerationError>);
  });

  it("returns a validated OpenRouter-style memo when provider output is safe", async () => {
    const safeProvider: AiProvider = {
      name: "openrouter",
      model: "test-model",
      async generateCardMemo() {
        return {
          recommendation: "Review the cited Renaiss data before forming a collector decision.",
          evidence: ["Liquidity score is supported by Renaiss trades."],
          risks: ["Renaiss data can still be thin."],
          confidence: "medium",
          sourcesUsed: ["renaiss-os:card:official-card-001"],
          nextAction: { label: "Compare recent trades", type: "REVIEW_SOURCES" },
          disclaimer:
            "Informational only; Atlas does not request keys, approvals, custody, lending, or trade execution. Verify cited sources before acting."
        };
      }
    };

    const result = await generateCardMemo(memoInput(), {
      provider: safeProvider,
      now: new Date(observedAt)
    });

    expect(result.validationStatus).toBe("validated");
    expect(result.provider).toBe("openrouter");
  });

  it("allows boundary disclaimers to mention trade execution without treating them as advice", () => {
    const result = validateAiMemoOutput(
      {
        recommendation: "Review the cited Renaiss data before forming a collector decision.",
        evidence: ["Liquidity signal is supported by Renaiss trade rows."],
        risks: ["Renaiss data can still be thin."],
        confidence: "medium",
        sourcesUsed: ["renaiss-os:card:official-card-001"],
        nextAction: { label: "Compare recent trades", type: "REVIEW_SOURCES" },
        disclaimer:
          "Informational only; Atlas does not request keys, approvals, custody, lending, or trade execution. Verify cited sources before acting."
      },
      memoInput()
    );

    expect(result.success).toBe(true);
  });

  it("hashes official memo evidence deterministically", () => {
    expect(hashAiMemoInput(memoInput())).toHaveLength(64);
    expect(hashAiMemoInput(memoInput())).toBe(hashAiMemoInput(memoInput()));
  });
});
