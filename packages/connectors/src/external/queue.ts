import type {
  ExternalCompCardInput,
  ExternalCompQueueItem,
  ExternalCompQueueSourceState,
  ExternalCompSourcePlatform
} from "./types.js";

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value: Date | string | null | undefined): string | null {
  const date = toDate(value);
  return date == null ? null : date.toISOString();
}

export function buildExternalCompQueue(input: {
  cards: ExternalCompCardInput[];
  existingComps: ExternalCompQueueSourceState[];
  sources: ExternalCompSourcePlatform[];
  now: Date;
  staleAfterDays: number;
  limit: number;
}): ExternalCompQueueItem[] {
  const latestByTokenAndSource = new Map<string, Date>();
  const staleAfterMs = input.staleAfterDays * 86_400_000;

  for (const comp of input.existingComps) {
    const fetchedAt = toDate(comp.fetchedAt);
    if (fetchedAt == null) continue;
    const key = `${comp.tokenId}:${comp.platform}`;
    const current = latestByTokenAndSource.get(key);
    if (current == null || fetchedAt > current) latestByTokenAndSource.set(key, fetchedAt);
  }

  return input.cards
    .map((card): ExternalCompQueueItem | null => {
      const duePlatforms: ExternalCompSourcePlatform[] = [];
      const fetchedDates: Date[] = [];
      let missing = false;

      for (const platform of input.sources) {
        const fetchedAt = latestByTokenAndSource.get(`${card.tokenId}:${platform}`);
        if (fetchedAt == null) {
          duePlatforms.push(platform);
          missing = true;
          continue;
        }

        fetchedDates.push(fetchedAt);
        if (input.now.getTime() - fetchedAt.getTime() >= staleAfterMs) {
          duePlatforms.push(platform);
        }
      }

      if (duePlatforms.length === 0) return null;
      const latestFetchedAt =
        fetchedDates.sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
      const priority =
        (missing ? 100 : 50) +
        (card.fmvUsd == null ? 0 : Math.min(50, card.fmvUsd / 10)) +
        duePlatforms.length * 5;

      return {
        card,
        duePlatforms,
        priority,
        reason: missing ? "missing" : "stale",
        latestFetchedAt: toIso(latestFetchedAt)
      };
    })
    .filter((item): item is ExternalCompQueueItem => item != null)
    .sort((left, right) => right.priority - left.priority)
    .slice(0, input.limit);
}
