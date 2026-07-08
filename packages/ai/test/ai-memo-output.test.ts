import { describe, expect, it } from "vitest";

import { AiMemoOutputSchema, PROHIBITED_AI_PHRASES } from "../src/index.js";

describe("AiMemoOutputSchema", () => {
  it("requires citation-checked structured memo output", () => {
    const parsed = AiMemoOutputSchema.parse({
      recommendation: "Review Renaiss data before taking any collector action.",
      evidence: ["Renaiss confidence is high."],
      risks: ["Renaiss data can still be stale or thin."],
      confidence: "medium",
      sourcesUsed: ["renaiss-os:card:official-1"],
      nextAction: { label: "Review Renaiss data", type: "REVIEW_SOURCES" },
      disclaimer:
        "Informational only; Atlas does not request keys, approvals, custody, lending, or trade execution. Verify cited sources before acting."
    });

    expect(parsed.sourcesUsed).toEqual(["renaiss-os:card:official-1"]);
  });

  it("keeps the prohibited phrase catalog explicit", () => {
    expect(PROHIBITED_AI_PHRASES).toContain("seed phrase");
    expect(PROHIBITED_AI_PHRASES).toContain("trade execution");
  });
});
