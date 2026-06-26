import { describe, expect, it } from "vitest";

import { extractSerialBigInt, extractSerialDigits, isAdjacentSerial } from "../src/index.js";

describe("serial utilities", () => {
  it("extracts visible PSA-style serial digits", () => {
    expect(extractSerialDigits("PSA12345678")).toBe("12345678");
    expect(extractSerialDigits("PSA 10 Cert 12345678")).toBe("12345678");
    expect(extractSerialDigits("Cert # 00123456")).toBe("123456");
  });

  it("returns bigint serials when digits exist", () => {
    expect(extractSerialBigInt("PSA12345678")).toBe(12345678n);
  });

  it("detects adjacent serials independent of order", () => {
    expect(isAdjacentSerial("12345678", "12345679")).toBe(true);
    expect(isAdjacentSerial("12345679", "12345678")).toBe(true);
    expect(isAdjacentSerial("12345678", "12345680")).toBe(false);
  });

  it("handles missing or malformed serials safely", () => {
    expect(extractSerialDigits("No visible cert")).toBeNull();
    expect(isAdjacentSerial("No visible cert", "123")).toBe(false);
  });
});
