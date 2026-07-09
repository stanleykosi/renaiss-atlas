import { describe, expect, it } from "vitest";

import { formatGradeLabel, gradeLabelTitle } from "./display";

describe("Renaiss OS display helpers", () => {
  it("keeps graded PSA labels readable", () => {
    expect(formatGradeLabel({ company: "PSA", grade: "10 Gem Mint", gradeLabel: "PSA 10" })).toBe("PSA 10");
    expect(gradeLabelTitle({ company: "PSA", grade: "10 Gem Mint", gradeLabel: "PSA 10" })).toBe("PSA graded 10 Gem Mint.");
  });

  it("renames raw condition buckets as ungraded", () => {
    expect(formatGradeLabel({ company: "RAW", grade: "A", gradeLabel: "RAW A" })).toBe("Ungraded A");
    expect(formatGradeLabel({ gradeLabel: "Raw B" })).toBe("Ungraded B");
  });
});
