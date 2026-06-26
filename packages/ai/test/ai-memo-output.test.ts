import { describe, expect, it } from "vitest";

import { AiMemoOutputSchema, PROHIBITED_AI_PHRASES } from "../src/index.js";

describe("AiMemoOutputSchema", () => {
  it("requires source-cited structured memo output", () => {
    const parsed = AiMemoOutputSchema.parse({
      recommendation: "Watch until live marketplace data is available.",
      evidence: ["Seed source is clearly labeled."],
      risks: ["Live Renaiss data has not been connected."],
      confidence: "low",
      sourcesUsed: ["mock:scaffold"],
      nextAction: { label: "Watch card", type: "WATCH" },
      disclaimer: "Informational scaffold output only; verify live data before acting."
    });

    expect(parsed.sourcesUsed).toEqual(["mock:scaffold"]);
  });

  it("keeps the prohibited phrase catalog explicit", () => {
    expect(PROHIBITED_AI_PHRASES).toContain("seed phrase");
  });
});
