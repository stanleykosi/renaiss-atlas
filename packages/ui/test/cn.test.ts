import { describe, expect, it } from "vitest";

import { cn } from "../src/cn.js";

describe("cn", () => {
  it("merges Tailwind classes deterministically", () => {
    const maybeHidden: string | undefined = undefined;

    expect(cn("px-2", "px-4", maybeHidden)).toBe("px-4");
  });
});
