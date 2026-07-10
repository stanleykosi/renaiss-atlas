import { describe, expect, it } from "vitest";

import { RenaissOsConfidenceSchema, RenaissOsTradeKindSchema } from "../src/index.js";

describe("Renaiss OS primitive schemas", () => {
  it("accepts official confidence values and null", () => {
    expect(RenaissOsConfidenceSchema.parse("prime")).toBe("prime");
    expect(RenaissOsConfidenceSchema.parse(null)).toBeNull();
    expect(RenaissOsConfidenceSchema.safeParse("unknown").success).toBe(false);
  });

  it("accepts only official trade kinds", () => {
    expect(RenaissOsTradeKindSchema.parse("listing")).toBe("listing");
    expect(RenaissOsTradeKindSchema.parse("transaction")).toBe("transaction");
    expect(RenaissOsTradeKindSchema.safeParse("sale").success).toBe(false);
  });
});
