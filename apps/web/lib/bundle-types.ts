import type { BundleType } from "@renaiss/core";

import type { ConfidenceLabel, DataSourceMode, MarketCard } from "@/lib/market-types";

export type BundleItemView = {
  tokenId: string;
  position: number;
  role: string;
  card: Pick<
    MarketCard,
    | "tokenId"
    | "name"
    | "setName"
    | "cardNumber"
    | "characterName"
    | "ownerUsername"
    | "askPriceUsd"
    | "fmvUsd"
    | "status"
    | "mockData"
  > | null;
};

export type BundleView = {
  id: string;
  bundleType: BundleType;
  label: string;
  name: string;
  summary: string;
  score: number;
  confidence: ConfidenceLabel;
  reasons: string[];
  riskFlags: string[];
  totalAskUsd: number | null;
  totalFmvUsd: number | null;
  items: BundleItemView[];
  itemCount: number;
  sourceMode: DataSourceMode;
  sourceLabel: string;
  mockData: boolean;
};

export type BundleOverview = {
  sourceMode: DataSourceMode;
  generatedAt: string;
  bundles: BundleView[];
  health: {
    totalBundles: number;
    highConfidenceBundles: number;
    detectedCards: number;
    totalAskUsd: number;
    totalFmvUsd: number;
    mockData: boolean;
  };
};
