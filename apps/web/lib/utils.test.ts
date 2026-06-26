import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("web cn", () => {
  it("merges Tailwind class conflicts", () => {
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });
});
