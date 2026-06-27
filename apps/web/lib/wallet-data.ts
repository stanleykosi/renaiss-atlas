import { getAddress, isAddress } from "viem";
import type { ActionRecommendation, ActionType, ScoreConfidence } from "@renaiss/core";

import { getBundleOverview } from "@/lib/bundle-data";
import type { BundleView } from "@/lib/bundle-types";
import { getMarketOverview } from "@/lib/market-data";
import type { MarketCard } from "@/lib/market-types";
import type { WalletHolding, WalletLookupResult, WalletSummary } from "@/lib/wallet-types";

function toFiniteNumber(value: number | null | undefined): number | null {
  return value == null || !Number.isFinite(value) ? null : value;
}

function average(values: (number | null | undefined)[]): number | null {
  const usable = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (usable.length === 0) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function confidenceFor(value: number): ScoreConfidence {
  if (value >= 75) return "high";
  if (value >= 45) return "medium";
  return "low";
}

function normalizeWalletAddress(address: string) {
  const decoded = decodeURIComponent(address).trim();
  if (!isAddress(decoded)) return null;
  return getAddress(decoded);
}

function actionLabel(card: MarketCard): string {
  if (card.riskFlags.includes("external_comp_mismatch")) return "Avoid push";
  if (card.freshness === "stale") return "Refresh";
  if (card.status === "unlisted" && (card.scores.demand?.value ?? 0) >= 35) return "List";
  if ((card.scores.collector_premium?.value ?? 0) >= 25) return "Bundle";
  if ((card.dealScore ?? 0) >= 60) return "Review";
  return "Watch";
}

function actionPriority(card: MarketCard): number {
  let priority = 40;

  priority += (card.scores.demand?.value ?? 0) * 0.2;
  priority += (card.scores.collector_premium?.value ?? 0) * 0.25;
  priority += (card.liquidityScore ?? 0) * 0.2;
  priority += (card.dealScore ?? 0) * 0.15;

  if (card.status === "unlisted" && (card.scores.demand?.value ?? 0) >= 35) priority += 18;
  if (card.riskFlags.includes("external_comp_mismatch")) priority += 22;
  if (card.freshness === "stale") priority += 12;
  if (card.mockData) priority -= 5;

  return Number(Math.max(1, Math.min(100, priority)).toFixed(2));
}

function hasIntentSignal(card: MarketCard): boolean {
  const demand = card.scores.demand;
  if (card.demoCase === "intent match") return true;
  if (demand == null || demand.value < 20) return false;
  return !demand.riskFlags.includes("intent_data_missing");
}

function toHolding(card: MarketCard): WalletHolding {
  return {
    ...card,
    actionPriority: actionPriority(card),
    actionLabel: actionLabel(card)
  };
}

function walletSourceIds(holdings: readonly WalletHolding[], bundles: readonly BundleView[]): string[] {
  return uniqueStrings([
    ...holdings.flatMap((holding) => holding.sourceIds),
    ...bundles.map((bundle) => `bundle:${bundle.id}`)
  ]);
}

function buildAction(input: {
  address: string;
  actionType: ActionType;
  priority: number;
  title: string;
  reason: string;
  confidence: ScoreConfidence;
  impact: string;
  risks?: string[];
  sourceIds: string[];
  cta?: ActionRecommendation["cta"];
}): ActionRecommendation {
  return {
    subjectType: "wallet",
    subjectId: input.address,
    actionType: input.actionType,
    priority: input.priority,
    title: input.title,
    reason: input.reason,
    confidence: input.confidence,
    impact: input.impact,
    risks: input.risks ?? [],
    sourceIds: input.sourceIds,
    cta: input.cta
  };
}

function buildSummary(input: {
  address: string;
  holdings: WalletHolding[];
  bundles: BundleView[];
  sourceMode: WalletSummary["sourceMode"];
  generatedAt: string;
}): WalletSummary {
  const listedCards = input.holdings.filter((holding) => holding.status === "listed").length;
  const unlistedCards = input.holdings.filter((holding) => holding.status === "unlisted").length;
  const highConfidenceCompCards = input.holdings.filter(
    (holding) =>
      (holding.externalCompConfidenceScore ?? 0) >= 70 ||
      holding.externalComps.some((comp) => !comp.rejected && comp.matchConfidence >= 70)
  ).length;
  const staleCards = input.holdings.filter((holding) => holding.freshness === "stale").length;
  const intentMatchCount = input.holdings.filter(hasIntentSignal).length;
  const mockData = input.holdings.some((holding) => holding.mockData) || input.bundles.some((bundle) => bundle.mockData);

  return {
    address: input.address,
    totalCards: input.holdings.length,
    listedCards,
    unlistedCards,
    estimatedFmvUsd: input.holdings.reduce((sum, holding) => sum + (holding.fmvUsd ?? 0), 0),
    listedAskUsd: input.holdings.reduce((sum, holding) => sum + (holding.askPriceUsd ?? 0), 0),
    averageLiquidityScore: average(input.holdings.map((holding) => holding.liquidityScore)),
    highConfidenceCompRatio: ratio(highConfidenceCompCards, input.holdings.length),
    staleDataRatio: ratio(staleCards, input.holdings.length),
    bundleOpportunityCount: input.bundles.length,
    intentMatchCount,
    topCardsByActionPriority: [...input.holdings]
      .sort((left, right) => right.actionPriority - left.actionPriority)
      .slice(0, 5),
    sourceMode: input.sourceMode,
    sourceLabel: input.sourceMode === "seed" || mockData ? "Seed fixtures" : "Postgres",
    mockData,
    generatedAt: input.generatedAt
  };
}

function buildActions(input: {
  address: string;
  summary: WalletSummary;
  holdings: WalletHolding[];
  bundles: BundleView[];
}): ActionRecommendation[] {
  const sourceIds = walletSourceIds(input.holdings, input.bundles);
  const topHolding = input.summary.topCardsByActionPriority[0];
  const topBundle = [...input.bundles].sort((left, right) => right.score - left.score)[0];
  const mismatchCard = input.holdings.find((holding) => holding.riskFlags.includes("external_comp_mismatch"));
  const demandCard = input.holdings
    .filter((holding) => holding.status === "unlisted" && hasIntentSignal(holding))
    .sort((left, right) => (right.scores.demand?.value ?? 0) - (left.scores.demand?.value ?? 0))[0];
  const staleCount = input.holdings.filter((holding) => holding.freshness === "stale").length;
  const actions: ActionRecommendation[] = [];

  if (mismatchCard != null) {
    actions.push(
      buildAction({
        address: input.address,
        actionType: "AVOID",
        priority: 1,
        title: "Resolve comp mismatch before promotion",
        reason: `${mismatchCard.name} has rejected external comp evidence, so avoid aggressive listing or share copy until the mismatch is reviewed.`,
        confidence: "medium",
        impact: "risk_control",
        risks: ["external_comp_mismatch"],
        sourceIds: mismatchCard.sourceIds,
        cta: { label: "Open card", href: `/cards/${encodeURIComponent(mismatchCard.tokenId)}` }
      })
    );
  }

  if (topBundle != null) {
    actions.push(
      buildAction({
        address: input.address,
        actionType: "BUNDLE",
        priority: actions.length + 1,
        title: "Package the strongest bundle",
        reason: `${topBundle.name} scores ${Math.round(topBundle.score)} with ${topBundle.confidence} confidence across ${topBundle.itemCount} cards.`,
        confidence: topBundle.confidence,
        impact: "liquidity",
        risks: topBundle.riskFlags,
        sourceIds: [`bundle:${topBundle.id}`],
        cta: { label: "Open bundles", href: "/bundles" }
      })
    );
  }

  if (demandCard != null) {
    actions.push(
      buildAction({
        address: input.address,
        actionType: "MATCH_INTENT",
        priority: actions.length + 1,
        title: "Review demand before listing",
        reason: `${demandCard.name} is unlisted but has demand-score support, making it the clearest intent-review candidate in this wallet.`,
        confidence: demandCard.scores.demand?.confidence ?? "medium",
        impact: "demand",
        risks: demandCard.scores.demand?.riskFlags ?? [],
        sourceIds: demandCard.sourceIds,
        cta: { label: "Open card", href: `/cards/${encodeURIComponent(demandCard.tokenId)}` }
      })
    );
  }

  if (staleCount > 0) {
    actions.push(
      buildAction({
        address: input.address,
        actionType: "WATCH",
        priority: actions.length + 1,
        title: "Refresh stale holdings before acting",
        reason: `${staleCount} holding${staleCount === 1 ? "" : "s"} have stale marketplace evidence, so confidence should be capped until source data refreshes.`,
        confidence: "low",
        impact: "data_quality",
        risks: ["stale_renaiss_data"],
        sourceIds
      })
    );
  }

  if (topHolding != null) {
    actions.push(
      buildAction({
        address: input.address,
        actionType: topHolding.status === "unlisted" ? "LIST" : "WATCH",
        priority: actions.length + 1,
        title: `${topHolding.actionLabel} ${topHolding.name}`,
        reason: `This card has the highest wallet action priority at ${Math.round(topHolding.actionPriority)} based on demand, liquidity, deal, risk, and collector-premium signals.`,
        confidence: confidenceFor(toFiniteNumber(topHolding.actionPriority) ?? 0),
        impact: "priority",
        risks: topHolding.riskFlags.filter((flag) => flag !== "mock_data"),
        sourceIds: topHolding.sourceIds,
        cta: { label: "Open card", href: `/cards/${encodeURIComponent(topHolding.tokenId)}` }
      })
    );
  }

  actions.push(
    buildAction({
      address: input.address,
      actionType: "SHARE",
      priority: actions.length + 1,
      title: "Share read-only wallet summary",
      reason: `Share ${input.summary.totalCards} cards, ${input.summary.bundleOpportunityCount} bundle opportunities, and estimated FMV without requesting a signature or exposing secrets.`,
      confidence: input.summary.mockData ? "medium" : "high",
      impact: "community",
      risks: input.summary.mockData ? ["mock_data"] : [],
      sourceIds
    })
  );

  return actions
    .sort((left, right) => left.priority - right.priority)
    .map((action, index) => ({ ...action, priority: index + 1 }));
}

export async function getWalletCopilot(address: string): Promise<WalletLookupResult> {
  const normalizedAddress = normalizeWalletAddress(address);

  if (normalizedAddress == null) {
    return {
      status: "invalid",
      address,
      message: "Enter a valid EVM wallet address. Atlas only reads public holdings and never requests signatures."
    };
  }

  const [market, bundleOverview] = await Promise.all([getMarketOverview(), getBundleOverview()]);
  const normalizedLower = normalizedAddress.toLowerCase();
  const holdings = market.cards
    .filter((card) => card.ownerAddress?.toLowerCase() === normalizedLower)
    .map(toHolding)
    .sort((left, right) => right.actionPriority - left.actionPriority);
  const holdingTokens = new Set(holdings.map((holding) => holding.tokenId));
  const walletBundles = bundleOverview.bundles
    .filter((bundle) => bundle.items.some((item) => holdingTokens.has(item.tokenId)))
    .sort((left, right) => right.score - left.score);
  const summary = buildSummary({
    address: normalizedAddress,
    holdings,
    bundles: walletBundles,
    sourceMode: market.sourceMode,
    generatedAt: market.generatedAt
  });

  if (holdings.length === 0) {
    return {
      status: "empty",
      address: normalizedAddress,
      summary,
      freshness: market.syncStatus.freshness
    };
  }

  return {
    status: "ready",
    data: {
      address: normalizedAddress,
      summary,
      actions: buildActions({
        address: normalizedAddress,
        summary,
        holdings,
        bundles: walletBundles
      }),
      holdings,
      bundles: walletBundles,
      freshness: market.syncStatus.freshness
    }
  };
}
