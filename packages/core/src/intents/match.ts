import { extractSerialBigInt } from "../utils/serial.js";

export type IntentMatchConfidence = "low" | "medium" | "high";

export type IntentMatchingIntentInput = {
  id: string;
  creatorAlias?: string | null;
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
  requiresSerialAdjacency?: boolean;
  requiresExternalComp?: boolean;
  minLiquidityScore?: string | number | null;
  status?: string;
  createdAt?: Date | string | null;
  expiresAt?: Date | string | null;
  mockData?: boolean;
};

export type IntentMatchingCardInput = {
  tokenId: string;
  name: string;
  setName?: string | null;
  cardNumber?: string | null;
  characterName?: string | null;
  tcg?: string | null;
  grader?: string | null;
  grade?: string | null;
  language?: string | null;
  year?: number | null;
  serial?: string | null;
  serialNum?: bigint | number | string | null;
  status?: "listed" | "unlisted" | "unknown";
  askPriceUsd?: number | null;
  fmvUsd?: number | null;
  liquidityScore?: number | null;
  externalCompConfidenceScore?: number | null;
  hasAcceptedExternalComp?: boolean;
};

export type IntentMatchResult = {
  intentId: string;
  tokenId: string;
  matchScore: number;
  confidence: IntentMatchConfidence;
  reasons: string[];
  riskFlags: string[];
};

export type MatchIntentsInput = {
  intents: IntentMatchingIntentInput[];
  cards: IntentMatchingCardInput[];
  now?: Date;
  minScore?: number;
};

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "around",
  "card",
  "cards",
  "for",
  "looking",
  "of",
  "or",
  "the",
  "to",
  "under",
  "with"
]);

function normalizeText(value: string | number | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9#.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textMatches(left: string | number | null | undefined, right: string | number | null | undefined): boolean {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (normalizedLeft.length === 0 || normalizedRight.length === 0) return false;
  return normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isActiveIntent(intent: IntentMatchingIntentInput, now: Date): boolean {
  if (intent.status != null && intent.status !== "active") return false;
  const expiresAt = toDate(intent.expiresAt);
  return expiresAt == null || expiresAt.getTime() > now.getTime();
}

function cardPrice(card: IntentMatchingCardInput): number | null {
  return card.askPriceUsd ?? card.fmvUsd ?? null;
}

function priceInRange(intent: IntentMatchingIntentInput, card: IntentMatchingCardInput): boolean {
  const price = cardPrice(card);
  const min = toNumber(intent.minPriceUsd);
  const max = toNumber(intent.maxPriceUsd);
  if (min == null && max == null) return false;
  if (price == null) return false;
  if (min != null && price < min) return false;
  return !(max != null && price > max);
}

function yearInRange(intent: IntentMatchingIntentInput, card: IntentMatchingCardInput): boolean {
  if (intent.minYear == null && intent.maxYear == null) return false;
  if (card.year == null) return false;
  if (intent.minYear != null && card.year < intent.minYear) return false;
  return !(intent.maxYear != null && card.year > intent.maxYear);
}

function hasExternalComp(card: IntentMatchingCardInput): boolean {
  return card.hasAcceptedExternalComp === true || (card.externalCompConfidenceScore ?? 0) >= 45;
}

function serialGroups(cards: readonly IntentMatchingCardInput[]): Map<string, Set<string>> {
  const byGrader = new Map<string, { tokenId: string; serialValue: bigint }[]>();

  for (const card of cards) {
    const serialValue = extractSerialBigInt(card.serialNum ?? card.serial);
    if (serialValue == null) continue;
    const key = normalizeText(`${card.grader ?? "unknown"}|${card.tcg ?? "unknown"}`);
    const current = byGrader.get(key) ?? [];
    current.push({ tokenId: card.tokenId, serialValue });
    byGrader.set(key, current);
  }

  const adjacent = new Map<string, Set<string>>();

  for (const group of byGrader.values()) {
    const sorted = [...group].sort((left, right) =>
      left.serialValue < right.serialValue ? -1 : left.serialValue > right.serialValue ? 1 : 0
    );
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const left = sorted[index];
      const right = sorted[index + 1];
      if (left == null || right == null || right.serialValue - left.serialValue !== 1n) continue;
      const leftSet = adjacent.get(left.tokenId) ?? new Set<string>();
      const rightSet = adjacent.get(right.tokenId) ?? new Set<string>();
      leftSet.add(right.tokenId);
      rightSet.add(left.tokenId);
      adjacent.set(left.tokenId, leftSet);
      adjacent.set(right.tokenId, rightSet);
    }
  }

  return adjacent;
}

function queryTokens(intent: IntentMatchingIntentInput): string[] {
  return normalizeText(
    [
      intent.queryText,
      intent.tcg,
      intent.characterName,
      intent.setName,
      intent.cardNumber,
      intent.grader,
      intent.grade,
      intent.language
    ]
      .filter(Boolean)
      .join(" ")
  )
    .split(" ")
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function cardTokens(card: IntentMatchingCardInput): Set<string> {
  return new Set(
    normalizeText(
      [
        card.name,
        card.tcg,
        card.characterName,
        card.setName,
        card.cardNumber,
        card.grader,
        card.grade,
        card.language,
        card.year
      ]
        .filter(Boolean)
        .join(" ")
    )
      .split(" ")
      .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
  );
}

function textFallbackScore(intent: IntentMatchingIntentInput, card: IntentMatchingCardInput): {
  score: number;
  reasons: string[];
} {
  const intentTokens = queryTokens(intent);
  const cardTokenSet = cardTokens(card);
  const matched = intentTokens.filter((token) => cardTokenSet.has(token));
  const uniqueMatched = [...new Set(matched)];
  const score = Math.min(40, uniqueMatched.length * 8);

  return {
    score,
    reasons:
      uniqueMatched.length === 0
        ? []
        : [`Query text overlaps card evidence: ${uniqueMatched.slice(0, 5).join(", ")}.`]
  };
}

function confidenceFromScore(score: number): IntentMatchConfidence {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function roundScore(value: number): number {
  return Number(Math.max(0, Math.min(100, value)).toFixed(2));
}

export function matchIntentToCard(input: {
  intent: IntentMatchingIntentInput;
  card: IntentMatchingCardInput;
  adjacentTokenIds?: ReadonlySet<string>;
  now?: Date;
}): IntentMatchResult | null {
  const now = input.now ?? new Date();
  if (!isActiveIntent(input.intent, now)) return null;

  const reasons: string[] = [];
  const riskFlags: string[] = [];
  let score = 0;

  if (input.intent.requiresExternalComp === true && !hasExternalComp(input.card)) {
    return null;
  }

  if (input.intent.requiresSerialAdjacency === true) {
    if ((input.adjacentTokenIds?.size ?? 0) === 0) return null;
    score += 15;
    reasons.push("Serial adjacency requirement is satisfied.");
  }

  if (textMatches(input.intent.characterName, input.card.characterName)) {
    score += 20;
    reasons.push("Character matches.");
  }
  if (textMatches(input.intent.cardNumber, input.card.cardNumber)) {
    score += 20;
    reasons.push("Card number matches.");
  }
  if (textMatches(input.intent.setName, input.card.setName)) {
    score += 15;
    reasons.push("Set matches.");
  }
  if (textMatches(input.intent.tcg, input.card.tcg)) {
    score += 10;
    reasons.push("TCG matches.");
  }
  if (textMatches(input.intent.language, input.card.language)) {
    score += 10;
    reasons.push("Language matches.");
  }
  if (textMatches(input.intent.grader, input.card.grader)) {
    score += 10;
    reasons.push("Grader matches.");
  }
  if (textMatches(input.intent.grade, input.card.grade)) {
    score += 10;
    reasons.push("Grade matches.");
  }
  if (priceInRange(input.intent, input.card)) {
    score += 10;
    reasons.push("Price range matches.");
  }
  if (yearInRange(input.intent, input.card)) {
    score += 5;
    reasons.push("Year range matches.");
  }

  const minLiquidityScore = toNumber(input.intent.minLiquidityScore);
  if (minLiquidityScore != null) {
    if ((input.card.liquidityScore ?? 0) >= minLiquidityScore) {
      score += 10;
      reasons.push("Liquidity threshold matches.");
    } else {
      riskFlags.push("low_liquidity");
      reasons.push("Liquidity is below the stated preference.");
    }
  }

  const fallback = textFallbackScore(input.intent, input.card);
  score += fallback.score;
  reasons.push(...fallback.reasons);

  const matchScore = roundScore(score);
  if (matchScore <= 0) return null;

  return {
    intentId: input.intent.id,
    tokenId: input.card.tokenId,
    matchScore,
    confidence: confidenceFromScore(matchScore),
    reasons: [...new Set(reasons)].slice(0, 8),
    riskFlags: [...new Set(riskFlags)]
  };
}

export function matchIntentsToCards(input: MatchIntentsInput): IntentMatchResult[] {
  const now = input.now ?? new Date();
  const minScore = input.minScore ?? 45;
  const adjacencyByToken = serialGroups(input.cards);
  const matches: IntentMatchResult[] = [];

  for (const intent of input.intents) {
    for (const card of input.cards) {
      const adjacentTokenIds = adjacencyByToken.get(card.tokenId);
      const matchInput: {
        intent: IntentMatchingIntentInput;
        card: IntentMatchingCardInput;
        adjacentTokenIds?: ReadonlySet<string>;
        now: Date;
      } = {
        intent,
        card,
        now
      };
      if (adjacentTokenIds != null) {
        matchInput.adjacentTokenIds = adjacentTokenIds;
      }
      const match = matchIntentToCard(matchInput);
      if (match == null || match.matchScore < minScore) continue;
      matches.push(match);
    }
  }

  return matches.sort((left, right) => {
    if (right.matchScore !== left.matchScore) return right.matchScore - left.matchScore;
    return left.tokenId.localeCompare(right.tokenId, undefined, { numeric: true });
  });
}
