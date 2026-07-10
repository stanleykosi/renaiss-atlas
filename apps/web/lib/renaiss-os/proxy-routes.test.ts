import { describe, expect, it } from "vitest";

import { matchRenaissOsProxyPath } from "./proxy-routes";

describe("matchRenaissOsProxyPath", () => {
  it("matches supported official API paths", () => {
    expect(matchRenaissOsProxyPath(["indices"])?.remotePath).toBe("/v1/indices");
    expect(
      matchRenaissOsProxyPath(["cards", "pokemon", "base-set", "4-charizard-psa-10"])?.remotePath
    ).toBe("/v1/cards/pokemon/base-set/4-charizard-psa-10");
    expect(matchRenaissOsProxyPath(["graded", "12345678", "stream"])?.remotePath).toBe(
      "/v1/graded/12345678/stream"
    );
  });

  it("rejects normalized aliases and unsupported child paths", () => {
    expect(matchRenaissOsProxyPath([" indices "])).toBeNull();
    expect(matchRenaissOsProxyPath(["", "indices"])).toBeNull();
    expect(
      matchRenaissOsProxyPath(["cards", "pokemon", "base-set", "4-charizard", "prices"])
    ).toBeNull();
  });
});
