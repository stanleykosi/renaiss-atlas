import { describe, expect, it } from "vitest";

import { scaffoldJobResult } from "../src/job-runner.js";

describe("worker scaffold", () => {
  it("exposes safe no-op job commands", () => {
    expect(scaffoldJobResult("score").status).toBe("skipped");
  });
});
