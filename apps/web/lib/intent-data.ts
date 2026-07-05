import { randomUUID } from "node:crypto";
import { getAddress, isAddress } from "viem";
import {
  CreateIntentInputSchema,
  matchIntentsToCards,
  type CreateIntentInput,
  type IntentMatchingCardInput,
  type IntentMatchingIntentInput,
  type IntentMatchResult
} from "@renaiss/core";
import {
  createDbClient,
  createIntentsRepo,
  DatabaseEnvSchema,
  demoIntentMatches,
  demoIntents,
  intentMatches,
  intents
} from "@renaiss/db";

import { getMarketOverview } from "@/lib/market-data";
import type { ConfidenceLabel, DataSourceMode, MarketCard } from "@/lib/market-types";
import type { CreateIntentResponse, IntentBoardOverview, IntentMatchView, IntentView } from "@/lib/intent-types";

type IntentRow = {
  id: string;
  creatorAlias?: string | null;
  creatorWallet?: string | null;
  creatorDiscordId?: string | null;
  intentType: string;
  queryText: string;
  tcg?: string | null;
  characterName?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  grader?: string | null;
  grade?: string | null;
  language?: string | null;
  minYear?: number | null;
  maxYear?: number | null;
  minPriceUsd?: string | number | null;
  maxPriceUsd?: string | number | null;
  requiresSerialAdjacency?: boolean | null;
  requiresExternalComp?: boolean | null;
  minLiquidityScore?: string | number | null;
  status?: string | null;
  expiresAt?: Date | string | null;
  createdAt?: Date | string | null;
  metadata?: unknown;
};

type StoredIntentMatchRow = {
  intentId: string;
  tokenId: string;
  matchScore: string | number;
  confidence?: string | null;
  reasons?: unknown;
  createdAt?: Date | string | null;
};

function shouldUseSeedData(): boolean {
  return process.env["DEMO_MODE"] !== "false" || process.env["DATABASE_URL"] == null;
}

function toIso(value: Date | string | null | undefined): string {
  if (value == null) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function confidenceLabel(value: string | null | undefined): ConfidenceLabel {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function replaceControlCharacters(value: string): string {
  let output = "";
  for (const character of value) {
    const code = character.charCodeAt(0);
    output += code <= 31 || code === 127 ? " " : character;
  }
  return output;
}

function cleanString(value: string | null | undefined): string | null {
  const cleaned = replaceControlCharacters(value ?? "").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeWallet(value: string | null | undefined): string | null {
  const cleaned = cleanString(value);
  if (cleaned == null) return null;
  return isAddress(cleaned) ? getAddress(cleaned) : cleaned;
}

function intentToMatchingInput(intent: IntentRow): IntentMatchingIntentInput {
  const metadata = toRecord(intent.metadata);

  return {
    id: intent.id,
    creatorAlias: intent.creatorAlias ?? null,
    intentType: intent.intentType,
    queryText: intent.queryText,
    tcg: intent.tcg ?? null,
    characterName: intent.characterName ?? null,
    setName: intent.setName ?? null,
    cardNumber: intent.cardNumber ?? null,
    grader: intent.grader ?? null,
    grade: intent.grade ?? null,
    language: intent.language ?? null,
    minYear: intent.minYear ?? null,
    maxYear: intent.maxYear ?? null,
    minPriceUsd: intent.minPriceUsd ?? null,
    maxPriceUsd: intent.maxPriceUsd ?? null,
    requiresSerialAdjacency: intent.requiresSerialAdjacency ?? false,
    requiresExternalComp: intent.requiresExternalComp ?? false,
    minLiquidityScore: intent.minLiquidityScore ?? null,
    status: intent.status ?? "active",
    createdAt: intent.createdAt ?? null,
    expiresAt: intent.expiresAt ?? null,
    mockData: metadata["mockData"] === true
  };
}

function cardToMatchingInput(card: MarketCard): IntentMatchingCardInput {
  return {
    tokenId: card.tokenId,
    name: card.name,
    setName: card.setName,
    cardNumber: card.cardNumber,
    characterName: card.characterName,
    tcg: card.tcg,
    grader: card.grader,
    grade: card.grade,
    language: card.language,
    year: card.year,
    serial: card.serial,
    serialNum: card.serialNum,
    status: card.status,
    askPriceUsd: card.askPriceUsd,
    fmvUsd: card.fmvUsd,
    liquidityScore: card.liquidityScore,
    externalCompConfidenceScore: card.externalCompConfidenceScore,
    hasAcceptedExternalComp: card.externalComps.some((comp) => !comp.rejected)
  };
}

function mergeMatches(input: {
  stored: StoredIntentMatchRow[];
  computed: IntentMatchResult[];
  now: Date;
}) {
  const matches = new Map<
    string,
    {
      intentId: string;
      tokenId: string;
      matchScore: number;
      confidence: ConfidenceLabel;
      reasons: string[];
      riskFlags: string[];
      createdAt: string;
    }
  >();

  for (const match of input.stored) {
    const key = `${match.intentId}:${match.tokenId}`;
    matches.set(key, {
      intentId: match.intentId,
      tokenId: match.tokenId,
      matchScore: toNumber(match.matchScore) ?? 0,
      confidence: confidenceLabel(match.confidence),
      reasons: stringArray(match.reasons),
      riskFlags: [],
      createdAt: toIso(match.createdAt)
    });
  }

  for (const match of input.computed) {
    const key = `${match.intentId}:${match.tokenId}`;
    const current = matches.get(key);
    if (current == null || match.matchScore > current.matchScore || current.reasons.length === 0) {
      matches.set(key, {
        intentId: match.intentId,
        tokenId: match.tokenId,
        matchScore: match.matchScore,
        confidence: match.confidence,
        reasons: match.reasons,
        riskFlags: match.riskFlags,
        createdAt: input.now.toISOString()
      });
    }
  }

  return [...matches.values()].sort((left, right) => right.matchScore - left.matchScore);
}

function cardView(card: MarketCard | null) {
  if (card == null) return null;

  return {
    tokenId: card.tokenId,
    name: card.name,
    setName: card.setName,
    cardNumber: card.cardNumber,
    characterName: card.characterName,
    tcg: card.tcg,
    status: card.status,
    askPriceUsd: card.askPriceUsd,
    fmvUsd: card.fmvUsd,
    liquidityScore: card.liquidityScore,
    demandScore: card.scores.demand?.value ?? null,
    mockData: card.mockData
  };
}

function toIntentView(input: {
  intent: IntentRow;
  matches: IntentMatchView[];
  sourceMode: DataSourceMode;
}): IntentView {
  const metadata = toRecord(input.intent.metadata);
  const mockData = metadata["mockData"] === true || input.sourceMode === "seed";

  return {
    id: input.intent.id,
    creatorAlias: input.intent.creatorAlias ?? null,
    creatorWallet: input.intent.creatorWallet ?? null,
    intentType: input.intent.intentType,
    queryText: input.intent.queryText,
    tcg: input.intent.tcg ?? null,
    characterName: input.intent.characterName ?? null,
    setName: input.intent.setName ?? null,
    cardNumber: input.intent.cardNumber ?? null,
    grader: input.intent.grader ?? null,
    grade: input.intent.grade ?? null,
    language: input.intent.language ?? null,
    minYear: input.intent.minYear ?? null,
    maxYear: input.intent.maxYear ?? null,
    minPriceUsd: toNumber(input.intent.minPriceUsd),
    maxPriceUsd: toNumber(input.intent.maxPriceUsd),
    requiresSerialAdjacency: input.intent.requiresSerialAdjacency ?? false,
    requiresExternalComp: input.intent.requiresExternalComp ?? false,
    minLiquidityScore: toNumber(input.intent.minLiquidityScore),
    status: input.intent.status ?? "active",
    expiresAt: toIsoOrNull(input.intent.expiresAt),
    createdAt: toIso(input.intent.createdAt),
    sourceLabel: input.sourceMode === "seed" || mockData ? "Seed fixtures" : "Postgres",
    mockData,
    matches: input.matches
  };
}

function firstIntentView(board: IntentBoardOverview): IntentView {
  const intent = board.intents[0];
  if (intent == null) {
    throw new Error("Intent board did not produce a created intent.");
  }
  return intent;
}

async function readStoredIntentRows(): Promise<{
  intents: IntentRow[];
  matches: StoredIntentMatchRow[];
  sourceMode: DataSourceMode;
} | null> {
  if (shouldUseSeedData()) {
    return {
      intents: demoIntents,
      matches: demoIntentMatches,
      sourceMode: "seed"
    };
  }

  const env = DatabaseEnvSchema.safeParse(process.env);
  if (!env.success) return null;

  const database = createDbClient(env.data.DATABASE_URL, {
    databaseSsl: env.data.DATABASE_SSL,
    max: 1
  });

  try {
    const [intentRows, matchRows] = await Promise.all([
      database.db.select().from(intents),
      database.db.select().from(intentMatches)
    ]);

    return {
      intents: intentRows,
      matches: matchRows,
      sourceMode: "database"
    };
  } catch {
    return null;
  } finally {
    await database.close();
  }
}

function buildIntentBoard(input: {
  intents: IntentRow[];
  storedMatches: StoredIntentMatchRow[];
  cards: MarketCard[];
  sourceMode: DataSourceMode;
  generatedAt: string;
}): IntentBoardOverview {
  const now = new Date(input.generatedAt);
  const cardsByToken = new Map(input.cards.map((card) => [card.tokenId, card]));
  const intentsById = new Map(input.intents.map((intent) => [intent.id, intent]));
  const computedMatches = matchIntentsToCards({
    intents: input.intents.map(intentToMatchingInput),
    cards: input.cards.map(cardToMatchingInput),
    now
  });
  const mergedMatches = mergeMatches({
    stored: input.storedMatches,
    computed: computedMatches,
    now
  });
  const matchesByIntent = new Map<string, IntentMatchView[]>();

  for (const match of mergedMatches) {
    const intent = intentsById.get(match.intentId);
    if (intent == null) continue;
    const current = matchesByIntent.get(match.intentId) ?? [];
    current.push({
      intentId: match.intentId,
      intentType: intent.intentType,
      queryText: intent.queryText,
      creatorAlias: intent.creatorAlias ?? null,
      tokenId: match.tokenId,
      matchScore: match.matchScore,
      confidence: match.confidence,
      reasons: match.reasons,
      riskFlags: match.riskFlags,
      createdAt: match.createdAt,
      card: cardView(cardsByToken.get(match.tokenId) ?? null)
    });
    matchesByIntent.set(match.intentId, current);
  }

  const views = input.intents
    .map((intent) =>
      toIntentView({
        intent,
        matches: matchesByIntent.get(intent.id) ?? [],
        sourceMode: input.sourceMode
      })
    )
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  return {
    sourceMode: input.sourceMode,
    generatedAt: input.generatedAt,
    intents: views,
    health: {
      activeIntents: views.filter((intent) => intent.status === "active").length,
      matchedCards: new Set(views.flatMap((intent) => intent.matches.map((match) => match.tokenId))).size,
      highConfidenceMatches: views.flatMap((intent) => intent.matches).filter((match) => match.confidence === "high").length,
      mockData: views.some((intent) => intent.mockData)
    }
  };
}

export async function getIntentBoard(): Promise<IntentBoardOverview> {
  const [market, stored] = await Promise.all([getMarketOverview(), readStoredIntentRows()]);
  const intentRows = stored ?? {
    intents: demoIntents,
    matches: demoIntentMatches,
    sourceMode: market.sourceMode
  };

  return buildIntentBoard({
    intents: intentRows.intents,
    storedMatches: intentRows.matches,
    cards: market.cards,
    sourceMode: intentRows.sourceMode,
    generatedAt: market.generatedAt
  });
}

export async function getIntentMatchesForCard(tokenId: string): Promise<IntentMatchView[]> {
  const board = await getIntentBoard();
  return board.intents.flatMap((intent) =>
    intent.matches.filter((match) => match.tokenId === tokenId)
  );
}

export async function getIntentMatches(intentId: string): Promise<IntentMatchView[] | null> {
  const board = await getIntentBoard();
  const intent = board.intents.find((item) => item.id === intentId);
  return intent?.matches ?? null;
}

export function sanitizeCreateIntentInput(input: CreateIntentInput): CreateIntentInput {
  return {
    ...input,
    creatorAlias: cleanString(input.creatorAlias ?? null),
    creatorWallet: normalizeWallet(input.creatorWallet ?? null),
    creatorDiscordId: cleanString(input.creatorDiscordId ?? null),
    queryText: cleanString(input.queryText) ?? input.queryText.trim(),
    tcg: cleanString(input.tcg ?? null),
    characterName: cleanString(input.characterName ?? null),
    setName: cleanString(input.setName ?? null),
    cardNumber: cleanString(input.cardNumber ?? null),
    grader: cleanString(input.grader ?? null),
    grade: cleanString(input.grade ?? null),
    language: cleanString(input.language ?? null)
  };
}

function rowFromCreateInput(input: CreateIntentInput, id: string, now: Date): IntentRow {
  return {
    id,
    creatorAlias: input.creatorAlias ?? null,
    creatorWallet: input.creatorWallet ?? null,
    creatorDiscordId: input.creatorDiscordId ?? null,
    intentType: input.intentType,
    queryText: input.queryText,
    tcg: input.tcg ?? null,
    characterName: input.characterName ?? null,
    setName: input.setName ?? null,
    cardNumber: input.cardNumber ?? null,
    grader: input.grader ?? null,
    grade: input.grade ?? null,
    language: input.language ?? null,
    minYear: input.minYear ?? null,
    maxYear: input.maxYear ?? null,
    minPriceUsd: input.minPriceUsd ?? null,
    maxPriceUsd: input.maxPriceUsd ?? null,
    requiresSerialAdjacency: input.requiresSerialAdjacency,
    requiresExternalComp: input.requiresExternalComp,
    minLiquidityScore: input.minLiquidityScore ?? null,
    status: input.status ?? "active",
    expiresAt: input.expiresAt ?? null,
    createdAt: now,
    metadata: { source: "user_created" }
  };
}

export async function createIntentWithMatches(rawInput: unknown): Promise<CreateIntentResponse> {
  const parsed = CreateIntentInputSchema.parse(rawInput);
  const input = sanitizeCreateIntentInput(parsed);
  const market = await getMarketOverview();
  const now = new Date(market.generatedAt);
  const seedMode = shouldUseSeedData();

  if (seedMode) {
    const intent = rowFromCreateInput(input, randomUUID(), now);
    const board = buildIntentBoard({
      intents: [intent],
      storedMatches: [],
      cards: market.cards,
      sourceMode: "seed",
      generatedAt: market.generatedAt
    });

    return {
      intent: firstIntentView(board),
      persisted: false,
      rateLimited: false
    };
  }

  const env = DatabaseEnvSchema.safeParse(process.env);
  if (!env.success) {
    const intent = rowFromCreateInput(input, randomUUID(), now);
    const board = buildIntentBoard({
      intents: [intent],
      storedMatches: [],
      cards: market.cards,
      sourceMode: market.sourceMode,
      generatedAt: market.generatedAt
    });

    return {
      intent: firstIntentView(board),
      persisted: false,
      rateLimited: false
    };
  }

  const database = createDbClient(env.data.DATABASE_URL, {
    databaseSsl: env.data.DATABASE_SSL,
    max: 1
  });

  try {
    const repo = createIntentsRepo(database.db);
    const created = await repo.create({
      creatorAlias: input.creatorAlias ?? null,
      creatorWallet: input.creatorWallet ?? null,
      creatorDiscordId: input.creatorDiscordId ?? null,
      intentType: input.intentType,
      queryText: input.queryText,
      tcg: input.tcg ?? null,
      characterName: input.characterName ?? null,
      setName: input.setName ?? null,
      cardNumber: input.cardNumber ?? null,
      grader: input.grader ?? null,
      grade: input.grade ?? null,
      language: input.language ?? null,
      minYear: input.minYear ?? null,
      maxYear: input.maxYear ?? null,
      minPriceUsd: input.minPriceUsd ?? null,
      maxPriceUsd: input.maxPriceUsd ?? null,
      requiresSerialAdjacency: input.requiresSerialAdjacency,
      requiresExternalComp: input.requiresExternalComp,
      minLiquidityScore: input.minLiquidityScore == null ? null : String(input.minLiquidityScore),
      status: input.status ?? "active",
      expiresAt: input.expiresAt == null ? null : new Date(input.expiresAt),
      metadata: { source: "user_created" }
    });

    const matches = matchIntentsToCards({
      intents: [intentToMatchingInput(created)],
      cards: market.cards.map(cardToMatchingInput),
      now
    });

    await repo.replaceMatches(
      created.id,
      matches.map((match) => ({
        intentId: match.intentId,
        tokenId: match.tokenId,
        matchScore: match.matchScore.toFixed(2),
        confidence: match.confidence,
        reasons: match.reasons,
        createdAt: now
      }))
    );

    const board = buildIntentBoard({
      intents: [created],
      storedMatches: matches.map((match) => ({
        intentId: match.intentId,
        tokenId: match.tokenId,
        matchScore: match.matchScore,
        confidence: match.confidence,
        reasons: match.reasons,
        createdAt: now
      })),
      cards: market.cards,
      sourceMode: "database",
      generatedAt: market.generatedAt
    });

    return {
      intent: firstIntentView(board),
      persisted: true,
      rateLimited: false
    };
  } finally {
    await database.close();
  }
}
