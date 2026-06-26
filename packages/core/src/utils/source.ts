function normalizeSourcePart(value: string | number | Date): string {
  const raw = value instanceof Date ? value.toISOString() : String(value);

  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createSourceId(namespace: string, parts: readonly (string | number | Date)[]): string {
  const normalizedNamespace = normalizeSourcePart(namespace);
  const normalizedParts = parts.map(normalizeSourcePart).filter((part) => part.length > 0);

  return [normalizedNamespace, ...normalizedParts].join(":");
}

export function createScoreSourceId(
  scoreType: string,
  entityId: string,
  computedAt: string | Date
): string {
  return createSourceId("score", [scoreType, entityId, computedAt]);
}

