export function extractSerialDigits(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    return null;
  }

  const raw = String(value).trim();
  if (raw.length === 0) return null;

  const matches = raw.match(/\d[\d, ]*\d|\d/g);
  if (matches == null) return null;

  const normalized = matches
    .map((match) => match.replace(/\D/g, ""))
    .filter((match) => match.length > 0)
    .sort((a, b) => b.length - a.length)[0];

  if (normalized == null) return null;

  return normalized.replace(/^0+(?=\d)/, "");
}

export function extractSerialBigInt(value: unknown): bigint | null {
  const digits = extractSerialDigits(value);
  return digits == null ? null : BigInt(digits);
}

export function isAdjacentSerial(first: unknown, second: unknown): boolean {
  const firstSerial = extractSerialBigInt(first);
  const secondSerial = extractSerialBigInt(second);

  if (firstSerial == null || secondSerial == null) return false;

  const diff = firstSerial > secondSerial ? firstSerial - secondSerial : secondSerial - firstSerial;
  return diff === 1n;
}
