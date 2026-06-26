import { describe, expect, it } from "vitest";

import type { ConnectorResult } from "../src/index.js";

describe("ConnectorResult", () => {
  it("requires source and freshness metadata around normalized data", () => {
    const result = {
      source: "mock",
      sourceUrl: "https://example.com/mock",
      fetchedAt: "2026-06-26T00:00:00.000Z",
      data: { ok: true },
      warnings: []
    } satisfies ConnectorResult<{ ok: true }>;

    expect(result.source).toBe("mock");
    expect(result.warnings).toEqual([]);
  });
});
