const PRICE_SENTINELS = new Set(["", "NO-ASK-PRICE", "NO-OFFER-PRICE", "null", "undefined"]);

function normalizeIntegerInput(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === "bigint") {
    return value > 0n ? value.toString() : null;
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return String(value);
  }

  const raw = String(value).trim();
  if (PRICE_SENTINELS.has(raw)) return null;
  if (!/^\d+$/.test(raw)) return null;

  const normalized = raw.replace(/^0+(?=\d)/, "");
  return BigInt(normalized) > 0n ? normalized : null;
}

export function scaledIntegerToDecimal(value: unknown, scale: number): string | null {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new Error("scale must be a non-negative integer");
  }

  const digits = normalizeIntegerInput(value);
  if (digits == null) return null;

  if (scale === 0) return digits;

  const padded = digits.padStart(scale + 1, "0");
  const integerPart = padded.slice(0, -scale).replace(/^0+(?=\d)/, "");
  const fractionPart = padded.slice(-scale).replace(/0+$/, "");

  return fractionPart.length > 0 ? `${integerPart}.${fractionPart}` : integerPart;
}

export function parseWeiUsd(value: unknown): string | null {
  return scaledIntegerToDecimal(value, 18);
}

export function parseCentsUsd(value: unknown): string | null {
  return scaledIntegerToDecimal(value, 2);
}

export function parseRscFmv(value: unknown): string | null {
  if (value == null) return null;

  const raw = String(value).trim();
  const match = /^\$?n(\d+)$/.exec(raw);
  if (match == null) return null;

  return parseCentsUsd(match[1]);
}

export function formatUsd(value: string | number | null | undefined): string {
  if (value == null || value === "") return "Unavailable";

  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Unavailable";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(amount);
}

