import type { ExternalCompPlatform, SourceKind } from "@renaiss/core";

export type ExternalCompSourcePlatform = Extract<ExternalCompPlatform, "snkrdunk" | "pricecharting">;

export type ExternalCompFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ExternalCompCardInput = {
  tokenId: string;
  name: string;
  setName: string;
  cardNumber: string;
  characterName: string;
  tcg: string;
  grader?: string | null;
  grade?: string | null;
  language?: string | null;
  year?: number | null;
  fmvUsd?: number | null;
  askPriceUsd?: number | null;
};

export type ExchangeRateTable = {
  baseCurrency: "USD";
  ratesPerUsd: Record<string, number>;
  fetchedAt: string;
  source: SourceKind;
  sourceUrl: string;
  live: boolean;
};

export type ExternalCompCandidate = {
  externalId: string;
  platform: ExternalCompSourcePlatform;
  productTitle: string;
  productUrl?: string | null;
  currency: string;
  currentPrice?: number | null;
  lastSale?: number | null;
  averagePrice?: number | null;
  volume30d?: number | null;
  grade?: string | null;
  language?: string | null;
  cardNumber?: string | null;
  fetchedAt?: string | null;
  raw: unknown;
  fixture?: boolean;
};

export type NormalizedExternalCompSnapshot = {
  tokenId: string;
  platform: ExternalCompSourcePlatform;
  productTitle?: string | null;
  productUrl?: string | null;
  currency: "USD";
  currentPriceUsd?: string | null;
  lastSaleUsd?: string | null;
  averagePriceUsd?: string | null;
  volume30d?: number | null;
  gradeMatched?: boolean | null;
  languageMatched?: boolean | null;
  cardNumberMatched?: boolean | null;
  matchConfidence: string;
  matchReasons: string[];
  rejected: boolean;
  rejectionReason?: string | null;
  fetchedAt: string;
  metadata: Record<string, unknown>;
};

export type ExternalDataQualityEvent = {
  source: SourceKind;
  entityType?: string | null;
  entityId?: string | null;
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  details: Record<string, unknown>;
};

export type ExternalCompPage = {
  source: ExternalCompSourcePlatform;
  sourceUrl: string;
  requestUrl: string;
  responseStatus: number | null;
  platform: ExternalCompSourcePlatform;
  tokenId: string;
  searchTerm: string;
  fetchedAt: string;
  rawJson?: unknown;
  rawTextExcerpt?: string | null;
  candidates: ExternalCompCandidate[];
  snapshots: NormalizedExternalCompSnapshot[];
  dataQualityEvents: ExternalDataQualityEvent[];
  warnings: string[];
  usedJinaFallback: boolean;
  live: boolean;
};

export type ExternalCompSyncData = {
  pages: ExternalCompPage[];
  snapshots: NormalizedExternalCompSnapshot[];
  dataQualityEvents: ExternalDataQualityEvent[];
  warnings: string[];
  exchangeRates: ExchangeRateTable;
  live: boolean;
};

export type ExternalCompPersistResult = {
  sourceRecords: number;
  externalPriceSnapshots: number;
  dataQualityEvents: number;
};

export type ExternalCompQueueSourceState = {
  tokenId: string;
  platform: ExternalCompSourcePlatform;
  fetchedAt?: Date | string | null;
};

export type ExternalCompQueueItem = {
  card: ExternalCompCardInput;
  duePlatforms: ExternalCompSourcePlatform[];
  priority: number;
  reason: "missing" | "stale";
  latestFetchedAt: string | null;
};

export type ExternalCompConnectorConfig = {
  platform: ExternalCompSourcePlatform;
  liveEnabled: boolean;
  baseUrl: string;
  jinaReaderBaseUrl: string;
  priceChartingApiToken?: string | null;
  priceChartingApiUrl?: string;
  rateLimitMs: number;
  retryAttempts: number;
  retryBaseDelayMs: number;
  fetch: ExternalCompFetch;
};

export type ExternalCompConnectorInput = {
  cards: ExternalCompCardInput[];
  exchangeRates: ExchangeRateTable;
};

export type ExternalCompEnvConfig = {
  enabled: boolean;
  liveEnabled: boolean;
  sources: ExternalCompSourcePlatform[];
  batchSize: number;
  staleDays: number;
  rateLimitMs: number;
  retryAttempts: number;
  jinaReaderBaseUrl: string;
  snkrdunkBaseUrl: string;
  priceChartingBaseUrl: string;
  priceChartingApiUrl: string;
  priceChartingApiToken: string | null;
  exchangeRatesLiveEnabled: boolean;
  exchangeRatesUrl: string;
};
