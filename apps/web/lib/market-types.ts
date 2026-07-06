import type { ScoreConfidence, StoredCardScoreType } from "@renaiss/core";

export type FreshnessStatus = "fresh" | "stale" | "missing";
export type DataSourceMode = "seed" | "database";
export type CardStatus = "listed" | "unlisted" | "unknown";
export type ConfidenceLabel = ScoreConfidence;

export type MarketScore = {
  scoreType: StoredCardScoreType;
  value: number;
  confidence: ConfidenceLabel;
  reasons: string[];
  riskFlags: string[];
  computedAt: string;
  inputsHash: string | null;
  source: "deterministic" | "persisted";
};

export type MarketCard = {
  tokenId: string;
  itemId: string | null;
  name: string;
  setName: string;
  cardNumber: string;
  characterName: string;
  tcg: string;
  ownerAddress: string | null;
  ownerUsername: string | null;
  grader: string | null;
  grade: string | null;
  language: string | null;
  year: number | null;
  serial: string | null;
  serialNum: string | null;
  imageUrl: string | null;
  status: CardStatus;
  askPriceUsd: number | null;
  fmvUsd: number | null;
  offerPriceUsd: number | null;
  topOfferUsd: number | null;
  lastSaleUsd: number | null;
  buybackBaseValueUsd: number | null;
  liquidityScore: number | null;
  dealScore: number | null;
  priceConfidenceScore: number | null;
  externalCompConfidenceScore: number | null;
  scores: Partial<Record<StoredCardScoreType, MarketScore>>;
  confidence: ConfidenceLabel;
  dealDeltaPct: number | null;
  observedAt: string | null;
  freshness: FreshnessStatus;
  sourceLabel: string;
  sourceIds: string[];
  riskFlags: string[];
  mockData: boolean;
  demoCase: string | null;
  externalComps: MarketExternalComp[];
};

export type MarketExternalComp = {
  id: string;
  platform: string;
  productTitle: string | null;
  productUrl: string | null;
  currency: string;
  currentPriceUsd: number | null;
  lastSaleUsd: number | null;
  averagePriceUsd: number | null;
  volume30d: number | null;
  gradeMatched: boolean | null;
  languageMatched: boolean | null;
  cardNumberMatched: boolean | null;
  matchConfidence: number;
  matchReasons: string[];
  rejected: boolean;
  rejectionReason: string | null;
  fetchedAt: string;
  sourceLabel: string;
  mockData: boolean;
};

export type MarketHealth = {
  totalCards: number;
  listedCards: number;
  unlistedCards: number;
  totalAskUsd: number;
  totalFmvUsd: number;
  averageLiquidityScore: number | null;
  underFmvCount: number;
  externalMismatchCount: number;
  staleCards: number;
  lastObservedAt: string | null;
  freshness: FreshnessStatus;
  sourceMode: DataSourceMode;
  sourceLabel: string;
  mockData: boolean;
};

export type SyncStatus = {
  sourceMode: DataSourceMode;
  generatedAt: string;
  latestRun: {
    id: string;
    jobName: string;
    source: string | null;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    recordsSeen: number;
    recordsFailed: number;
  } | null;
  freshness: {
    source: string;
    observedAt?: string;
    status: FreshnessStatus;
    message?: string;
  }[];
};

export type MarketFilters = {
  q: string;
  status: "all" | CardStatus;
  language: string;
  grader: string;
  grade: string;
  sortBy: MarketSortKey;
  sortDir: "asc" | "desc";
  mismatchesOnly: boolean;
};

export type MarketSortKey =
  | "name"
  | "askPriceUsd"
  | "fmvUsd"
  | "liquidityScore"
  | "dealScore"
  | "observedAt";

export type MarketOverview = {
  sourceMode: DataSourceMode;
  generatedAt: string;
  cards: MarketCard[];
  health: MarketHealth;
  syncStatus: SyncStatus;
  filters: {
    languages: string[];
    graders: string[];
    grades: string[];
    statuses: CardStatus[];
  };
};

export type CardListResponse = {
  items: MarketCard[];
  page: number;
  pageSize: number;
  total: number;
  freshness: SyncStatus["freshness"];
};

export type CardDetailResponse = {
  item: MarketCard;
  freshness: SyncStatus["freshness"];
};
