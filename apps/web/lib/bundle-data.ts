import { detectBundles, type BundleDetectionIntentInput } from "@renaiss/core";
import {
  createDbClient,
  DatabaseEnvSchema,
  demoIntentMatches,
  demoIntents,
  intentMatches,
  intents
} from "@renaiss/db";

import { getMarketOverview } from "@/lib/market-data";
import type { BundleOverview, BundleView } from "@/lib/bundle-types";
import type { DataSourceMode, MarketCard } from "@/lib/market-types";
import { allowSeedData } from "./data-mode";

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function bundleLabel(bundleType: string) {
  return bundleType.replaceAll("_", " ");
}

async function readIntentEvidence(sourceMode: DataSourceMode) {
  if (sourceMode === "seed" || allowSeedData()) {
    return {
      intents: demoIntents.map((intent): BundleDetectionIntentInput => ({
        id: intent.id,
        queryText: intent.queryText,
        intentType: intent.intentType,
        status: intent.status
      })),
      intentMatches: demoIntentMatches.map((match) => ({
        intentId: match.intentId,
        tokenId: match.tokenId,
        matchScore: toNumber(match.matchScore) ?? 0
      }))
    };
  }

  const env = DatabaseEnvSchema.safeParse(process.env);
  if (!env.success) return { intents: [], intentMatches: [] };

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
      intents: intentRows.map((intent): BundleDetectionIntentInput => ({
        id: intent.id,
        queryText: intent.queryText,
        intentType: intent.intentType,
        status: intent.status
      })),
      intentMatches: matchRows.map((match) => ({
        intentId: match.intentId,
        tokenId: match.tokenId,
        matchScore: toNumber(match.matchScore) ?? 0
      }))
    };
  } catch {
    return { intents: [], intentMatches: [] };
  } finally {
    await database.close();
  }
}

function cardToDetectionInput(card: MarketCard) {
  return {
    tokenId: card.tokenId,
    name: card.name,
    setName: card.setName,
    cardNumber: card.cardNumber,
    characterName: card.characterName,
    tcg: card.tcg,
    ownerAddress: card.ownerAddress,
    ownerUsername: card.ownerUsername,
    grader: card.grader,
    grade: card.grade,
    language: card.language,
    serial: card.serial,
    serialNum: card.serialNum,
    status: card.status,
    askPriceUsd: card.askPriceUsd,
    fmvUsd: card.fmvUsd,
    mockData: card.mockData
  };
}

function toBundleView(input: {
  bundle: ReturnType<typeof detectBundles>[number];
  cardsByToken: Map<string, MarketCard>;
  sourceMode: DataSourceMode;
}): BundleView {
  const items = input.bundle.items.map((item) => {
    const card = input.cardsByToken.get(item.tokenId) ?? null;

    return {
      tokenId: item.tokenId,
      position: item.position,
      role: item.role,
      card:
        card == null
          ? null
          : {
              tokenId: card.tokenId,
              name: card.name,
              setName: card.setName,
              cardNumber: card.cardNumber,
              characterName: card.characterName,
              ownerUsername: card.ownerUsername,
              askPriceUsd: card.askPriceUsd,
              fmvUsd: card.fmvUsd,
              status: card.status,
              mockData: card.mockData
            }
    };
  });

  return {
    id: input.bundle.id,
    bundleType: input.bundle.bundleType,
    label: bundleLabel(input.bundle.bundleType),
    name: input.bundle.name,
    summary: input.bundle.summary,
    score: input.bundle.score,
    confidence: input.bundle.confidence,
    reasons: input.bundle.reasons,
    riskFlags: input.bundle.riskFlags,
    totalAskUsd: input.bundle.totalAskUsd,
    totalFmvUsd: input.bundle.totalFmvUsd,
    items,
    itemCount: items.length,
    sourceMode: input.sourceMode,
    sourceLabel: input.sourceMode === "seed" ? "Seed fixtures" : "Deterministic detector",
    mockData: items.some((item) => item.card?.mockData === true) || input.bundle.riskFlags.includes("mock_data")
  };
}

export async function getBundleOverview(): Promise<BundleOverview> {
  const market = await getMarketOverview();
  const intentEvidence = await readIntentEvidence(market.sourceMode);
  const cardsByToken = new Map(market.cards.map((card) => [card.tokenId, card]));
  const detected = detectBundles({
    cards: market.cards.map(cardToDetectionInput),
    intents: intentEvidence.intents,
    intentMatches: intentEvidence.intentMatches,
    now: new Date(market.generatedAt)
  });
  const bundles = detected.map((bundle) =>
    toBundleView({
      bundle,
      cardsByToken,
      sourceMode: market.sourceMode
    })
  );

  return {
    sourceMode: market.sourceMode,
    generatedAt: market.generatedAt,
    bundles,
    health: {
      totalBundles: bundles.length,
      highConfidenceBundles: bundles.filter((bundle) => bundle.confidence === "high").length,
      detectedCards: new Set(bundles.flatMap((bundle) => bundle.items.map((item) => item.tokenId))).size,
      totalAskUsd: bundles.reduce((sum, bundle) => sum + (bundle.totalAskUsd ?? 0), 0),
      totalFmvUsd: bundles.reduce((sum, bundle) => sum + (bundle.totalFmvUsd ?? 0), 0),
      mockData: bundles.some((bundle) => bundle.mockData)
    }
  };
}

export async function getBundlesForCard(tokenId: string): Promise<BundleView[]> {
  const overview = await getBundleOverview();
  return overview.bundles.filter((bundle) => bundle.items.some((item) => item.tokenId === tokenId));
}
