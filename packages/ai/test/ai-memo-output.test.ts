import { describe, expect, it } from "vitest";

import { AiMemoOutputSchema, PROHIBITED_AI_PHRASES } from "../src/index.js";

describe("AiMemoOutputSchema", () => {
  it("requires source-cited structured memo output", () => {
    const parsed = AiMemoOutputSchema.parse({
      recommendation: "Review official source breakdown before taking any collector action.",
      evidence: ["Renaiss OS source confidence is high."],
      risks: ["Official evidence can still be stale or sparse."],
      confidence: "medium",
      sourcesUsed: ["renaiss-os:card:official-1"],
      nextAction: { label: "Review sources", type: "REVIEW_SOURCES" },
      disclaimer: "Informational only; verify cited sources before acting."
    });

    expect(parsed.sourcesUsed).toEqual(["renaiss-os:card:official-1"]);
  });

  it("keeps the prohibited phrase catalog explicit", () => {
    expect(PROHIBITED_AI_PHRASES).toContain("seed phrase");
    expect(PROHIBITED_AI_PHRASES).toContain("trade execution");
  });
});
