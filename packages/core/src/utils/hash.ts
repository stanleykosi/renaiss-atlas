import { createHash } from "node:crypto";

type HashableValue =
  | string
  | number
  | boolean
  | null
  | readonly HashableValue[]
  | { readonly [key: string]: HashableValue | undefined };

function stableStringify(value: HashableValue): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const entries = Object.entries(value)
    .filter((entry): entry is [string, HashableValue] => entry[1] !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
    .join(",")}}`;
}

export function hashPayload(value: HashableValue): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}
