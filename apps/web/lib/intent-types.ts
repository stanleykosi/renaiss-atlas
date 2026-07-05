import type { ConfidenceLabel, DataSourceMode, MarketCard } from "@/lib/market-types";

export type IntentMatchCardView = Pick<
  MarketCard,
  | "tokenId"
  | "name"
  | "setName"
  | "cardNumber"
  | "characterName"
  | "tcg"
  | "status"
  | "askPriceUsd"
  | "fmvUsd"
  | "liquidityScore"
  | "mockData"
> & {
  demandScore: number | null;
};

export type IntentMatchView = {
  intentId: string;
  intentType: string;
  queryText: string;
  creatorAlias: string | null;
  tokenId: string;
  matchScore: number;
  confidence: ConfidenceLabel;
  reasons: string[];
  riskFlags: string[];
  createdAt: string;
  card: IntentMatchCardView | null;
};

export type IntentView = {
  id: string;
  creatorAlias: string | null;
  creatorWallet: string | null;
  intentType: string;
  queryText: string;
  tcg: string | null;
  characterName: string | null;
  setName: string | null;
  cardNumber: string | null;
  grader: string | null;
  grade: string | null;
  language: string | null;
  minYear: number | null;
  maxYear: number | null;
  minPriceUsd: number | null;
  maxPriceUsd: number | null;
  requiresSerialAdjacency: boolean;
  requiresExternalComp: boolean;
  minLiquidityScore: number | null;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  sourceLabel: string;
  mockData: boolean;
  matches: IntentMatchView[];
};

export type IntentBoardOverview = {
  sourceMode: DataSourceMode;
  generatedAt: string;
  intents: IntentView[];
  health: {
    activeIntents: number;
    matchedCards: number;
    highConfidenceMatches: number;
    mockData: boolean;
  };
};

export type CreateIntentResponse = {
  intent: IntentView;
  persisted: boolean;
  rateLimited: false;
};
