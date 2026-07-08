import { describe, expect, it } from "vitest";

import { app } from "../src/app.js";

describe("api health", () => {
  it("returns read-only health", async () => {
    const response = await app.request("/api/health");
    const body = (await response.json()) as { status: string; mode: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.mode).toBe("read-only");
  });
});
