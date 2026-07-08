import { describe, expect, it } from "vitest";

import { SourceRefSchema } from "../src/source.js";

describe("SourceRefSchema", () => {
  it("allows only official Renaiss OS source provenance", () => {
    const parsed = SourceRefSchema.parse({
      id: "renaiss-os:card:official-1",
      source: "renaiss_os_index",
      sourceUrl: "https://api.renaissos.com/v1/cards/pokemon/set/card",
      fetchedAt: "2026-06-26T00:00:00.000Z",
      confidence: "high"
    });

    expect(parsed.source).toBe("renaiss_os_index");
    expect(() =>
      SourceRefSchema.parse({
        id: "legacy:mock",
        source: "mock",
        fetchedAt: "2026-06-26T00:00:00.000Z",
        confidence: "low"
      })
    ).toThrow();
  });
});
