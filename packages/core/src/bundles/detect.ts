import type { BundleType } from "../schemas/bundle.schema.js";
import { hashPayload } from "../utils/hash.js";
import { extractSerialBigInt } from "../utils/serial.js";

export type BundleConfidence = "low" | "medium" | "high";

export type BundleDetectionCardInput = {
  tokenId: string;
  name: string;
  setName?: string | null;
  cardNumber?: string | null;
  characterName?: string | null;
  tcg?: string | null;
  ownerAddress?: string | null;
  ownerUsername?: string | null;
  grader?: string | null;
  grade?: string | null;
  language?: string | null;
  serial?: string | null;
  serialNum?: bigint | number | string | null;
  status?: "listed" | "unlisted" | "unknown";
  askPriceUsd?: number | null;
  fmvUsd?: number | null;
  mockData?: boolean;
};

export type BundleDetectionIntentInput = {
  id: string;
  queryText?: string | null;
  intentType?: string | null;
  status?: "active" | "expired" | "closed" | "hidden";
};

export type BundleDetectionIntentMatchInput = {
  intentId: string;
  tokenId: string;
  matchScore: number;
};

export type BundleDetectionInput = {
  cards: BundleDetectionCardInput[];
  intents?: BundleDetectionIntentInput[];
  intentMatches?: BundleDetectionIntentMatchInput[];
  now?: Date;
};

export type DetectedBundleItem = {
  tokenId: string;
  position: number;
  role: string;
};

export type DetectedBundle = {
  id: string;
  bundleType: BundleType;
  name: string;
  summary: string;
  score: number;
  confidence: BundleConfidence;
  reasons: string[];
  riskFlags: string[];
  totalAskUsd: number | null;
  totalFmvUsd: number | null;
  items: DetectedBundleItem[];
  metadata: Record<string, unknown>;
};

type GroupableCard = BundleDetectionCardInput & {
  serialValue: bigint | null;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function displayText(value: string | null | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function groupKey(values: readonly (string | number | null | undefined)[]): string | null {
  const normalized = values.map((value) => normalizeText(value == null ? null : String(value)));
  return normalized.every((value) => value.length > 0) ? normalized.join("|") : null;
}

function deterministicBundleId(bundleType: BundleType, key: string, tokenIds: readonly string[]): string {
  const hash = hashPayload({ bundleType, key, tokenIds: [...tokenIds].sort() });
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function roundScore(value: number): number {
  return Number(Math.max(0, Math.min(100, value)).toFixed(2));
}

function confidenceFromScore(score: number): BundleConfidence {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function totals(cards: readonly BundleDetectionCardInput[]) {
  const askValues = cards.map((card) => card.askPriceUsd).filter((value): value is number => value != null);
  const fmvValues = cards.map((card) => card.fmvUsd).filter((value): value is number => value != null);

  return {
    totalAskUsd: askValues.length === 0 ? null : askValues.reduce((sum, value) => sum + value, 0),
    totalFmvUsd: fmvValues.length === 0 ? null : fmvValues.reduce((sum, value) => sum + value, 0)
  };
}

function listedRatio(cards: readonly BundleDetectionCardInput[]): number {
  if (cards.length === 0) return 0;
  return cards.filter((card) => card.status === "listed").length / cards.length;
}

function sortCards(cards: readonly BundleDetectionCardInput[]) {
  return [...cards].sort((left, right) => {
    const leftSerial = extractSerialBigInt(left.serialNum ?? left.serial);
    const rightSerial = extractSerialBigInt(right.serialNum ?? right.serial);
    if (leftSerial != null && rightSerial != null && leftSerial !== rightSerial) {
      return leftSerial < rightSerial ? -1 : 1;
    }
    return left.tokenId.localeCompare(right.tokenId, undefined, { numeric: true });
  });
}

function makeBundle(input: {
  bundleType: BundleType;
  key: string;
  cards: BundleDetectionCardInput[];
  name: string;
  summary: string;
  baseScore: number;
  reasons: string[];
  riskFlags?: string[];
  role: string;
  metadata?: Record<string, unknown>;
}): DetectedBundle {
  const sortedCards = sortCards(input.cards);
  const tokenIds = sortedCards.map((card) => card.tokenId);
  const listedBonus = listedRatio(sortedCards) * 10;
  const priceCompletenessBonus =
    sortedCards.every((card) => card.askPriceUsd != null || card.fmvUsd != null) ? 5 : 0;
  const score = roundScore(input.baseScore + listedBonus + priceCompletenessBonus);
  const bundleTotals = totals(sortedCards);
  const riskFlags = [
    ...new Set([
      ...(input.riskFlags ?? []),
      ...(sortedCards.some((card) => card.mockData === true) ? ["mock_data"] : [])
    ])
  ];

  return {
    id: deterministicBundleId(input.bundleType, input.key, tokenIds),
    bundleType: input.bundleType,
    name: input.name,
    summary: input.summary,
    score,
    confidence: confidenceFromScore(score),
    reasons: input.reasons,
    riskFlags,
    ...bundleTotals,
    items: sortedCards.map((card, index) => ({
      tokenId: card.tokenId,
      position: index + 1,
      role: index === 0 && input.role === "sequential_cert" ? "first_cert" : input.role
    })),
    metadata: {
      detectedBy: "deterministic_bundle_detector_v1",
      key: input.key,
      tokenIds,
      ...input.metadata
    }
  };
}

function groupCards<Card extends BundleDetectionCardInput>(
  cards: readonly Card[],
  keyForCard: (card: Card) => string | null
) {
  const groups = new Map<string, Card[]>();

  for (const card of cards) {
    const key = keyForCard(card);
    if (key == null) continue;
    const current = groups.get(key) ?? [];
    current.push(card);
    groups.set(key, current);
  }

  return groups;
}

function detectSequentialCertPairs(cards: readonly BundleDetectionCardInput[]): DetectedBundle[] {
  const groupableCards: GroupableCard[] = cards
    .map((card) => ({
      ...card,
      serialValue: extractSerialBigInt(card.serialNum ?? card.serial)
    }))
    .filter((card) => card.serialValue != null);
  const byGrader = groupCards(groupableCards, (card) =>
    groupKey([card.grader, card.ownerAddress ?? "unknown-owner"])
  );
  const bundles: DetectedBundle[] = [];

  for (const [key, group] of byGrader) {
    const sorted = [...group].sort((left, right) => {
      if (left.serialValue == null || right.serialValue == null) return 0;
      return left.serialValue < right.serialValue ? -1 : left.serialValue > right.serialValue ? 1 : 0;
    });

    for (let index = 0; index < sorted.length - 1; index += 1) {
      const first = sorted[index];
      const second = sorted[index + 1];
      if (first?.serialValue == null || second?.serialValue == null) continue;
      if (second.serialValue - first.serialValue !== 1n) continue;

      bundles.push(
        makeBundle({
          bundleType: "sequential_cert_pair",
          key: `${key}|${String(first.serialValue)}-${String(second.serialValue)}`,
          cards: [first, second],
          name: `Sequential cert pair: ${first.name} + ${second.name}`,
          summary: "Adjacent certification numbers can create a collector-premium pair.",
          baseScore: 82,
          reasons: ["Adjacent certification numbers.", "Same grading authority.", "Shared owner context."],
          role: "sequential_cert",
          metadata: {
            firstSerial: String(first.serialValue),
            secondSerial: String(second.serialValue)
          }
        })
      );
    }
  }

  return bundles;
}

function detectGroupedBundles(cards: readonly BundleDetectionCardInput[]): DetectedBundle[] {
  const definitions: {
    bundleType: BundleType;
    role: string;
    baseScore: number;
    minCards: number;
    keyForCard: (card: BundleDetectionCardInput) => string | null;
    nameForGroup: (cards: BundleDetectionCardInput[]) => string;
    summary: string;
    reasons: string[];
  }[] = [
    {
      bundleType: "same_card",
      role: "same_card",
      baseScore: 74,
      minCards: 2,
      keyForCard: (card) =>
        groupKey([card.tcg, card.setName, card.cardNumber, card.grader, card.grade, card.language]),
      nameForGroup: (group) => `Same-card stack: ${displayText(group[0]?.name, "card")}`,
      summary: "Same card, grade, and language grouped for collector comparison.",
      reasons: ["Same TCG, set, card number, grade, and language."]
    },
    {
      bundleType: "same_character",
      role: "same_character",
      baseScore: 64,
      minCards: 2,
      keyForCard: (card) => groupKey([card.ownerAddress ?? "unknown-owner", card.tcg, card.characterName]),
      nameForGroup: (group) => `${displayText(group[0]?.characterName, "Character")} character bundle`,
      summary: "Same-character holdings can support collector storytelling and bundle discovery.",
      reasons: ["Same character.", "Shared owner context."]
    },
    {
      bundleType: "same_set",
      role: "same_set",
      baseScore: 56,
      minCards: 2,
      keyForCard: (card) => groupKey([card.ownerAddress ?? "unknown-owner", card.tcg, card.setName]),
      nameForGroup: (group) => `${displayText(group[0]?.setName, "Set")} set bundle`,
      summary: "Same-set cards can be reviewed together for collector completion signals.",
      reasons: ["Same set.", "Shared owner context."]
    },
    {
      bundleType: "same_wallet",
      role: "same_wallet",
      baseScore: 45,
      minCards: 2,
      keyForCard: (card) => groupKey([card.ownerAddress]),
      nameForGroup: (group) => `${displayText(group[0]?.ownerUsername, "Wallet")} wallet bundle`,
      summary: "Cards observed under the same owner can be reviewed as a wallet-level bundle.",
      reasons: ["Same observed owner wallet."]
    }
  ];
  const bundles: DetectedBundle[] = [];

  for (const definition of definitions) {
    const groups = groupCards(cards, definition.keyForCard);
    for (const [key, group] of groups) {
      if (group.length < definition.minCards) continue;
      bundles.push(
        makeBundle({
          bundleType: definition.bundleType,
          key,
          cards: group,
          name: definition.nameForGroup(group),
          summary: definition.summary,
          baseScore: definition.baseScore,
          reasons: definition.reasons,
          role: definition.role
        })
      );
    }
  }

  return bundles;
}

function detectIntentDrivenBundles(input: BundleDetectionInput): DetectedBundle[] {
  const cardsByToken = new Map(input.cards.map((card) => [card.tokenId, card]));
  const activeIntentIds = new Set(
    (input.intents ?? []).filter((intent) => (intent.status ?? "active") === "active").map((intent) => intent.id)
  );
  const intentById = new Map((input.intents ?? []).map((intent) => [intent.id, intent]));
  const matchesByIntent = new Map<string, BundleDetectionIntentMatchInput[]>();
  const bundles: DetectedBundle[] = [];

  for (const match of input.intentMatches ?? []) {
    if (!activeIntentIds.has(match.intentId)) continue;
    const current = matchesByIntent.get(match.intentId) ?? [];
    current.push(match);
    matchesByIntent.set(match.intentId, current);
  }

  for (const [intentId, matches] of matchesByIntent) {
    const usableMatches = matches.filter((match) => cardsByToken.has(match.tokenId));
    if (usableMatches.length === 0) continue;
    const cards = usableMatches.map((match) => cardsByToken.get(match.tokenId)).filter((card): card is BundleDetectionCardInput => card != null);
    const averageMatch =
      usableMatches.reduce((sum, match) => sum + Math.max(0, Math.min(100, match.matchScore)), 0) /
      usableMatches.length;
    const intent = intentById.get(intentId);

    bundles.push(
      makeBundle({
        bundleType: "intent_driven",
        key: intentId,
        cards,
        name: `Intent bundle: ${displayText(intent?.queryText, intentId)}`,
        summary: "Cards grouped because they match an active collector intent.",
        baseScore: Math.max(45, averageMatch * 0.75),
        reasons: ["Active intent match evidence.", "Bundle is informational and does not execute a trade."],
        riskFlags: usableMatches.length < 2 ? ["single_card_intent_match"] : [],
        role: "intent_match",
        metadata: {
          intentId,
          intentType: intent?.intentType ?? null,
          averageMatchScore: roundScore(averageMatch)
        }
      })
    );
  }

  return bundles;
}

export function detectBundles(input: BundleDetectionInput): DetectedBundle[] {
  const cards = input.cards.filter((card) => card.tokenId.length > 0);
  const bundles = [
    ...detectSequentialCertPairs(cards),
    ...detectGroupedBundles(cards),
    ...detectIntentDrivenBundles({ ...input, cards })
  ];
  const byId = new Map<string, DetectedBundle>();

  for (const bundle of bundles) {
    byId.set(bundle.id, bundle);
  }

  return [...byId.values()].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.name.localeCompare(right.name);
  });
}
