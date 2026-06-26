import { describe, expect, it } from "vitest";

import { parseCentsUsd, parseRscFmv, parseWeiUsd, scaledIntegerToDecimal } from "../src/index.js";

describe("money conversion utilities", () => {
  it("converts wei-like USDT prices without floating point overflow", () => {
    expect(parseWeiUsd("123450000000000000000")).toBe("123.45");
    expect(parseWeiUsd("1")).toBe("0.000000000000000001");
  });

  it("converts cent values into USD decimal strings", () => {
    expect(parseCentsUsd("11550")).toBe("115.5");
    expect(parseCentsUsd(123)).toBe("1.23");
  });

  it("parses RSC gacha FMV markers", () => {
    expect(parseRscFmv("$n11550")).toBe("115.5");
    expect(parseRscFmv("n99")).toBe("0.99");
  });

  it("rejects sentinel, zero, malformed, and unsafe values", () => {
    expect(parseWeiUsd("NO-ASK-PRICE")).toBeNull();
    expect(parseCentsUsd("0")).toBeNull();
    expect(parseCentsUsd("12.34")).toBeNull();
    expect(scaledIntegerToDecimal(Number.MAX_SAFE_INTEGER + 1, 2)).toBeNull();
  });
});
