import type { DataSourceMode, FreshnessStatus } from "@/lib/market-types";

export type PackObservedIntervals = {
  samples: number;
  minSeconds: number | null;
  medianSeconds: number | null;
  maxSeconds: number | null;
};

export type PackRecentPull = {
  activityId: string;
  packName: string;
  packSlug: string;
  tier: string | null;
  fmvUsd: number | null;
  psaId: string | null;
  frontImageUrl: string | null;
  pulledAt: string | null;
  sourceLabel: string;
  mockData: boolean;
};

export type PackMomentum = {
  packName: string;
  packSlug: string;
  pulls1h: number;
  pulls24h: number;
  totalPulls: number;
  fmvPulled24h: number;
  tierDistribution: Record<string, number>;
  observedIntervals: PackObservedIntervals;
  recentPulls: PackRecentPull[];
  latestPulledAt: string | null;
  freshness: FreshnessStatus;
  sourceLabel: string;
  mockData: boolean;
};

export type PackMomentumOverview = {
  sourceMode: DataSourceMode;
  generatedAt: string;
  packs: PackMomentum[];
  disclaimer: string;
  health: {
    totalPacks: number;
    totalPulls: number;
    pulls24h: number;
    fmvPulled24h: number;
    latestPulledAt: string | null;
    stalePacks: number;
    mockData: boolean;
  };
};
