import { describe, expect, it } from "vitest";

import { SourceRefSchema } from "../src/source.js";

describe("SourceRefSchema", () => {
  it("keeps source provenance explicit", () => {
    const parsed = SourceRefSchema.parse({
      id: "mock:card:demo-1",
      source: "mock",
      sourceUrl: "https://example.com/source",
      fetchedAt: "2026-06-26T00:00:00.000Z",
      confidence: "low"
    });

    expect(parsed.source).toBe("mock");
  });
});
