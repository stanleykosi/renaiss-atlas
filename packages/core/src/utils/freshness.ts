import type { Freshness, FreshnessStatus } from "../schemas/source-ref.schema.js";

type FreshnessInput = {
  source: Freshness["source"];
  observedAt?: Date | string | null;
  now?: Date;
  staleAfterMs: number;
};

function toDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function freshnessStatus(input: FreshnessInput): FreshnessStatus {
  if (input.observedAt == null) return "missing";

  const observedAt = toDate(input.observedAt);
  if (observedAt == null) return "missing";

  const now = input.now ?? new Date();
  return now.getTime() - observedAt.getTime() > input.staleAfterMs ? "stale" : "fresh";
}

export function freshnessLabel(input: FreshnessInput): Freshness {
  const status = freshnessStatus(input);

  if (status === "missing") {
    return {
      source: input.source,
      status,
      message: "No source observation is available."
    };
  }

  const observedAt = toDate(input.observedAt ?? "");
  const observedIso = observedAt?.toISOString();

  if (observedIso == null) {
    return {
      source: input.source,
      status: "missing",
      message: "Source observation timestamp is invalid."
    };
  }

  return {
    source: input.source,
    observedAt: observedIso,
    status,
    message:
      status === "fresh"
        ? "Source data is within the expected freshness window."
        : "Source data is older than the expected freshness window."
  };
}

