import { describe, expect, it } from "vitest";

import { sourceRecords } from "../src/schema.js";

describe("database schema scaffold", () => {
  it("starts with source records for provenance-first ingestion", () => {
    expect(sourceRecords.sourceUrl.name).toBe("source_url");
  });
});
