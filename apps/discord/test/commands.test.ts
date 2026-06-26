import { describe, expect, it } from "vitest";

import { atlasCommandNames } from "../src/commands.js";

describe("discord commands", () => {
  it("includes the Atlas market command scaffold", () => {
    expect(atlasCommandNames).toContain("market");
  });
});
