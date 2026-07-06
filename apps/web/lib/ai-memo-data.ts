import {
  AiCardMemoResultSchema,
  AiMemoOutputSchema,
  generateCardMemo,
  hashAiMemoInput,
  type AiCardMemoResult,
  type AiMemoInput
} from "@renaiss/ai";
import type { ActionRecommendation, Freshness, Score, SourceKind, SourceRef } from "@renaiss/core";
import {
  createAiMemosRepo,
  createDbClient,
  DatabaseEnvSchema
} from "@renaiss/db";

import { getCardDetail } from "@/lib/market-data";
import type { CardDetailResponse, ConfidenceLabel, MarketCard, MarketExternalComp } from "@/lib/market-types";

type AiMemoCard = NonNullable<AiMemoInput["card"]>;
type StoredAiMemoRow = Awaited<ReturnType<ReturnType<typeof createAiMemosRepo>["latestForSubject"]>>;

function shouldUseSeedData(): boolean {
  return process.env["DEMO_MODE"] !== "false" || process.env["DATABASE_URL"] == null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function normalizeLabel(value: string): string {
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : "unknown";
}

function bigintOrNull(value: string | null): bigint | null {
  if (value == null || !/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function validUrlOrNull(value: string | null): string | null {
  if (value == null) return null;
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function sourceKindForCard(card: MarketCard): SourceKind {
  if (card.mockData) return "mock";
  return "renaiss_marketplace_v0";
}

function sourceKindForComp(comp: MarketExternalComp): SourceKind {
  const platform = comp.platform.toLowerCase();
  if (platform.includes("snkr")) return "snkrdunk";
  if (platform.includes("price")) return "pricecharting";
  return "manual_seed";
}

function confidenceFromMatch(value: number): ConfidenceLabel {
  if (value >= 75) return "high";
  if (value >= 45) return "medium";
  return "low";
}

function sourceRefsForCard(card: MarketCard, nowIso: string): SourceRef[] {
  const observedAt = card.observedAt ?? nowIso;
  const sourceRefs = [
    ...card.sourceIds.map(
      (sourceId): SourceRef => ({
        id: sourceId,
        source: sourceKindForCard(card),
        fetchedAt: observedAt,
        confidence: card.confidence
      })
    ),
    ...card.externalComps.map(
      (comp): SourceRef => ({
        id: comp.id,
        source: sourceKindForComp(comp),
        fetchedAt: comp.fetchedAt,
        confidence: confidenceFromMatch(comp.matchConfidence)
      })
    )
  ];
  const uniqueRefs = new Map<string, SourceRef>();

  for (const sourceRef of sourceRefs) {
    uniqueRefs.set(sourceRef.id, sourceRef);
  }

  if (uniqueRefs.size === 0) {
    uniqueRefs.set(`atlas:derived:card:${card.tokenId}`, {
      id: `atlas:derived:card:${card.tokenId}`,
      source: card.mockData ? "mock" : "manual_seed",
      fetchedAt: observedAt,
      confidence: "low"
    });
  }

  return [...uniqueRefs.values()];
}

function freshnessForDetail(detail: CardDetailResponse, nowIso: string): Freshness[] {
  if (detail.freshness.length === 0) {
    return [{ source: "manual_seed", observedAt: nowIso, status: "missing" }];
  }

  return detail.freshness.map((freshness) => {
    const output: Freshness = {
      source: freshness.source,
      status: freshness.status
    };
    if (freshness.observedAt != null) output.observedAt = freshness.observedAt;
    if (freshness.message != null) output.message = freshness.message;
    return output;
  });
}

function cardForMemo(card: MarketCard, nowIso: string): AiMemoCard {
  const observedAt = card.observedAt ?? nowIso;

  return {
    tokenId: card.tokenId,
    itemId: card.itemId,
    name: card.name,
    normalizedName: normalizeLabel(card.name),
    setName: card.setName,
    cardNumber: card.cardNumber,
    characterName: card.characterName,
    tcg: card.tcg,
    ownerAddress: card.ownerAddress,
    ownerUsername: card.ownerUsername,
    grader: card.grader,
    grade: card.grade,
    language: card.language,
    year: card.year,
    serial: card.serial,
    serialNum: bigintOrNull(card.serialNum),
    imageUrl: validUrlOrNull(card.imageUrl),
    status: card.status,
    firstSeenAt: observedAt,
    lastSeenAt: observedAt
  };
}

function scoresForMemo(card: MarketCard): Score[] {
  return Object.values(card.scores).map((score) => ({
    entityType: "card",
    entityId: card.tokenId,
    scoreType: score.scoreType,
    scoreValue: score.value,
    confidence: score.confidence,
    inputsHash: score.inputsHash ?? `score:${card.tokenId}:${score.scoreType}`,
    reasons: score.reasons.length > 0 ? score.reasons : ["No score reason available."],
    riskFlags: score.riskFlags,
    computedAt: score.computedAt
  }));
}

function actionForMemo(input: {
  card: MarketCard;
  sourceIds: string[];
}): ActionRecommendation[] {
  const { card, sourceIds } = input;
  const actions: ActionRecommendation[] = [];

  if (card.riskFlags.includes("external_comp_mismatch")) {
    actions.push({
      subjectType: "card",
      subjectId: card.tokenId,
      actionType: "WATCH",
      priority: 1,
      title: "Verify comp mismatch",
      reason: "Resolve rejected external evidence before relying on price or deal signals.",
      confidence: "medium",
      risks: ["external_comp_mismatch"],
      sourceIds
    });
  }

  if (card.dealDeltaPct != null && card.dealDeltaPct > 10 && (card.dealScore ?? 0) >= 35) {
    actions.push({
      subjectType: "card",
      subjectId: card.tokenId,
      actionType: "WATCH",
      priority: 2,
      title: "Review discounted ask",
      reason: "Ask is below FMV with deterministic deal support. Treat this as an evidence review only.",
      confidence: card.confidence,
      risks: card.riskFlags.filter((flag) => flag !== "mock_data"),
      sourceIds
    });
  }

  if ((card.scores.demand?.value ?? 0) >= 25) {
    actions.push({
      subjectType: "card",
      subjectId: card.tokenId,
      actionType: "MATCH_INTENT",
      priority: 3,
      title: "Review demand fit",
      reason: "Active intent matches indicate seller demand, but Atlas does not execute listings or trades.",
      confidence: card.scores.demand?.confidence ?? "medium",
      risks: card.scores.demand?.riskFlags ?? [],
      sourceIds
    });
  }

  if (actions.length === 0) {
    actions.push({
      subjectType: "card",
      subjectId: card.tokenId,
      actionType: "WATCH",
      priority: 10,
      title: "Monitor price confidence",
      reason: "No urgent deterministic action candidate is present. Continue tracking score and freshness movement.",
      confidence: card.confidence,
      risks: card.riskFlags.filter((flag) => flag !== "mock_data"),
      sourceIds
    });
  }

  return actions;
}

export function buildCardMemoInput(detail: CardDetailResponse, now: Date = new Date()): AiMemoInput {
  const card = detail.item;
  const nowIso = now.toISOString();
  const sources = sourceRefsForCard(card, nowIso);
  const sourceIds = sources.map((source) => source.id);
  const riskFlags = unique([
    ...(card.mockData ? ["mock_data"] : []),
    ...card.riskFlags,
    ...card.externalComps
      .filter((comp) => comp.rejected)
      .map(() => "external_comp_mismatch")
  ]);

  return {
    subject: { type: "card", id: card.tokenId },
    card: cardForMemo(card, nowIso),
    scores: scoresForMemo(card),
    candidateActions: actionForMemo({ card, sourceIds }),
    sources,
    riskFlags,
    freshness: freshnessForDetail(detail, nowIso),
    mockData: card.mockData
  };
}

function storedRowToMemo(row: NonNullable<StoredAiMemoRow>): AiCardMemoResult | null {
  const output = AiMemoOutputSchema.safeParse(row.outputJson);
  if (!output.success) return null;

  const metadata = toRecord(row.metadata);
  const validationStatus =
    row.validationStatus === "validated" || row.validationStatus === "fallback"
      ? row.validationStatus
      : "rejected";
  if (validationStatus === "rejected") return null;

  const parsed = AiCardMemoResultSchema.safeParse({
    subject: { type: "card", id: row.subjectId },
    provider: row.provider,
    model: row.model,
    inputHash: row.inputHash,
    output: output.data,
    validationStatus,
    sourceIds: stringArray(row.sourceIdsJson).length > 0 ? stringArray(row.sourceIdsJson) : output.data.sourcesUsed,
    safetyIssues: stringArray(metadata["safetyIssues"]),
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    deterministicFallback: row.provider === "deterministic" || validationStatus === "fallback"
  });

  return parsed.success ? parsed.data : null;
}

async function readStoredCardMemo(subjectId: string, inputHash: string): Promise<AiCardMemoResult | null> {
  if (shouldUseSeedData()) return null;

  const env = DatabaseEnvSchema.safeParse(process.env);
  if (!env.success) return null;

  const database = createDbClient(env.data.DATABASE_URL, {
    databaseSsl: env.data.DATABASE_SSL,
    max: 1
  });

  try {
    const repo = createAiMemosRepo(database.db);
    const row = await repo.latestForSubject("card", subjectId);
    if (row?.inputHash !== inputHash) return null;
    return storedRowToMemo(row);
  } catch {
    return null;
  } finally {
    await database.close();
  }
}

async function persistCardMemo(result: AiCardMemoResult, mockData: boolean): Promise<void> {
  if (shouldUseSeedData()) return;

  const env = DatabaseEnvSchema.safeParse(process.env);
  if (!env.success) return;

  const database = createDbClient(env.data.DATABASE_URL, {
    databaseSsl: env.data.DATABASE_SSL,
    max: 1
  });

  try {
    const repo = createAiMemosRepo(database.db);
    await repo.create({
      subjectType: "card",
      subjectId: result.subject.id,
      provider: result.provider,
      model: result.model,
      inputHash: result.inputHash,
      outputJson: result.output,
      validationStatus: result.validationStatus,
      sourceIdsJson: result.sourceIds,
      metadata: {
        mockData,
        deterministicFallback: result.deterministicFallback,
        safetyIssues: result.safetyIssues
      }
    });
  } catch {
    return;
  } finally {
    await database.close();
  }
}

export async function getCardMemoForDetail(detail: CardDetailResponse): Promise<AiCardMemoResult> {
  const input = buildCardMemoInput(detail);
  const inputHash = hashAiMemoInput(input);
  const stored = await readStoredCardMemo(input.subject.id, inputHash);
  if (stored != null) return stored;

  const result = await generateCardMemo(input);
  await persistCardMemo(result, detail.item.mockData);
  return result;
}

export async function getCardMemo(tokenId: string): Promise<AiCardMemoResult | null> {
  const detail = await getCardDetail(tokenId);
  if (detail == null) return null;
  return getCardMemoForDetail(detail);
}
