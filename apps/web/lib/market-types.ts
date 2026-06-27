export type FreshnessStatus = "fresh" | "stale" | "missing";
export type DataSourceMode = "seed" | "database";
export type CardStatus = "listed" | "unlisted" | "unknown";
export type ConfidenceLabel = "low" | "medium" | "high";

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
  currentPriceUsd: number | null;
  averagePriceUsd: number | null;
  matchConfidence: number;
  rejected: boolean;
  rejectionReason: string | null;
  fetchedAt: string;
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
  language: "all" | string;
  grader: "all" | string;
  grade: "all" | string;
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
