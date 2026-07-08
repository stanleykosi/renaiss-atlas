import { describe, expect, it } from "vitest";

import {
  createAtlasRepositories,
  cards,
  demoBundles,
  demoCards,
  demoExternalPrices,
  demoIntents,
  demoPackActivities,
  parseDatabaseEnv,
  jobLocks,
  sourceRecords
} from "../src/index.js";

describe("database schema", () => {
  it("maps source records for provenance-first ingestion", () => {
    expect(sourceRecords.sourceUrl.name).toBe("source_url");
  });

  it("maps card primary key names to the existing SQL schema", () => {
    expect(cards.tokenId.name).toBe("token_id");
  });

  it("exports demo seed cards with mock-data labels", () => {
    expect(demoCards).toHaveLength(7);
    expect(demoCards.every((card) => card.metadata != null)).toBe(true);
  });

  it("covers required demo seed scenarios", () => {
    expect(demoPackActivities.map((activity) => activity.packSlug).sort()).toEqual([
      "omega",
      "renacrypt-pack"
    ]);
    expect(demoIntents.some((intent) => intent.status === "active")).toBe(true);
    expect(demoBundles).toHaveLength(2);
    expect(demoExternalPrices.some((price) => price.rejected === true)).toBe(true);
  });

  it("validates required database environment", () => {
    expect(() => parseDatabaseEnv({ DATABASE_URL: "" })).toThrow("DATABASE_URL");
    expect(parseDatabaseEnv({ DATABASE_URL: "postgres://example", DATABASE_SSL: "true" })).toEqual({
      DATABASE_URL: "postgres://example",
      DATABASE_SSL: true
    });
  });

  it("exports repository factory", () => {
    expect(typeof createAtlasRepositories).toBe("function");
  });

  it("maps job locks for single-run worker execution", () => {
    expect(jobLocks.jobName.name).toBe("job_name");
    expect(jobLocks.expiresAt.name).toBe("expires_at");
  });
});
