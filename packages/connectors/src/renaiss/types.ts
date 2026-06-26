import type { CardStatus, SourceKind } from "@renaiss/core";

export type RenaissMarketplaceStrategy = "auto" | "v0" | "trpc";

export type RenaissConcreteMarketplaceStrategy = Exclude<RenaissMarketplaceStrategy, "auto">;

export type RenaissMarketplaceFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type RenaissMarketplaceConfig = {
  strategy: RenaissMarketplaceStrategy;
  v0Url: string;
  trpcUrl: string;
  pageSize: number;
  maxPages: number;
  listedOnly: boolean;
  rateLimitMs: number;
  retryAttempts: number;
  retryBaseDelayMs: number;
  fetch: RenaissMarketplaceFetch;
};

export type RenaissMarketplaceInput = Partial<
  Pick<
    RenaissMarketplaceConfig,
    "strategy" | "pageSize" | "maxPages" | "listedOnly" | "rateLimitMs" | "retryAttempts"
  >
>;

export type RenaissNormalizedCard = {
  tokenId: string;
  itemId?: string | null;
  name: string;
  normalizedName: string;
  setName: string;
  normalizedSetName: string;
  cardNumber: string;
  characterName: string;
  normalizedCharacterName: string;
  tcg: string;
  ownerAddress?: string | null;
  ownerUsername?: string | null;
  vaultLocation?: string | null;
  grader?: string | null;
  grade?: string | null;
  language?: string | null;
  year?: number | null;
  serial?: string | null;
  serialNum?: bigint | null;
  imageUrl?: string | null;
  status: CardStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  metadata: Record<string, unknown>;
};

export type RenaissNormalizedPrice = {
  tokenId: string;
  askPriceUsd?: string | null;
  askPriceRaw?: string | null;
  askPriceRawUnit?: "wei_usdt" | "usd_cents" | "usd" | "unknown" | null;
  fmvUsd?: string | null;
  fmvRaw?: string | null;
  fmvRawUnit?: "wei_usdt" | "usd_cents" | "usd" | "unknown" | null;
  offerPriceUsd?: string | null;
  topOfferUsd?: string | null;
  lastSaleUsd?: string | null;
  buybackBaseValueUsd?: string | null;
  isListed: boolean;
  source: SourceKind;
  observedAt: string;
  metadata: Record<string, unknown>;
};

export type RenaissDataQualityEvent = {
  source: SourceKind;
  entityType?: string | null;
  entityId?: string | null;
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  details: Record<string, unknown>;
};

export type RenaissMarketplacePage = {
  strategy: RenaissConcreteMarketplaceStrategy;
  source: SourceKind;
  sourceUrl: string;
  requestUrl: string;
  responseStatus: number;
  offset: number;
  limit: number;
  fetchedAt: string;
  raw: unknown;
  rawItems: unknown[];
  cards: RenaissNormalizedCard[];
  prices: RenaissNormalizedPrice[];
  dataQualityEvents: RenaissDataQualityEvent[];
  warnings: string[];
  hasMore: boolean;
  nextOffset: number;
};

export type RenaissMarketplaceSyncData = {
  strategy: RenaissConcreteMarketplaceStrategy;
  pages: RenaissMarketplacePage[];
  cards: RenaissNormalizedCard[];
  prices: RenaissNormalizedPrice[];
  dataQualityEvents: RenaissDataQualityEvent[];
  warnings: string[];
};

export type RenaissMarketplacePersistResult = {
  sourceRecords: number;
  cards: number;
  priceSnapshots: number;
  latestPrices: number;
  dataQualityEvents: number;
};
