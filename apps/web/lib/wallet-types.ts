import type { ActionRecommendation } from "@renaiss/core";

import type { BundleView } from "@/lib/bundle-types";
import type { DataSourceMode, MarketCard } from "@/lib/market-types";

export type WalletHolding = MarketCard & {
  actionPriority: number;
  actionLabel: string;
};

export type WalletSummary = {
  address: string;
  totalCards: number;
  listedCards: number;
  unlistedCards: number;
  estimatedFmvUsd: number;
  listedAskUsd: number;
  averageLiquidityScore: number | null;
  highConfidenceCompRatio: number | null;
  staleDataRatio: number | null;
  bundleOpportunityCount: number;
  intentMatchCount: number;
  topCardsByActionPriority: WalletHolding[];
  sourceMode: DataSourceMode;
  sourceLabel: string;
  mockData: boolean;
  generatedAt: string;
};

export type WalletCopilotView = {
  address: string;
  summary: WalletSummary;
  actions: ActionRecommendation[];
  holdings: WalletHolding[];
  bundles: BundleView[];
  freshness: {
    source: string;
    observedAt?: string;
    status: "fresh" | "stale" | "missing";
    message?: string;
  }[];
};

export type WalletLookupResult =
  | {
      status: "invalid";
      address: string;
      message: string;
    }
  | {
      status: "empty";
      address: string;
      summary: WalletSummary;
      freshness: WalletCopilotView["freshness"];
    }
  | {
      status: "ready";
      data: WalletCopilotView;
    };
