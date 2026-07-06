import { getAtlasSubcommand, messageResponse, stringOption, type DiscordInteractionResponse } from "./interactions.js";
import type { DiscordInteraction } from "./interactions.js";

type ConfidenceLabel = "low" | "medium" | "high";
type FreshnessStatus = "fresh" | "stale" | "missing";

type FreshnessItemLike = {
  source: string;
  status: FreshnessStatus;
  observedAt?: string;
  message?: string;
};

type MarketScoreLike = {
  value: number;
  confidence: ConfidenceLabel;
};

type MarketExternalCompLike = {
  rejected: boolean;
  matchConfidence: number;
};

type MarketCardLike = {
  tokenId: string;
  name: string;
  status: string;
  askPriceUsd: number | null;
  fmvUsd: number | null;
  liquidityScore: number | null;
  dealScore: number | null;
  priceConfidenceScore: number | null;
  externalCompConfidenceScore: number | null;
  confidence: ConfidenceLabel;
  freshness: FreshnessStatus;
  sourceLabel: string;
  riskFlags: string[];
  mockData: boolean;
  scores: Partial<Record<"demand", MarketScoreLike>>;
  externalComps: MarketExternalCompLike[];
};

type MarketOverviewLike = {
  generatedAt: string;
  cards: MarketCardLike[];
  health: {
    totalCards: number;
    listedCards: number;
    underFmvCount: number;
    externalMismatchCount: number;
    averageLiquidityScore: number | null;
    freshness: FreshnessStatus;
    sourceLabel: string;
    mockData: boolean;
  };
  syncStatus: {
    freshness: FreshnessItemLike[];
  };
};

type CardDetailLike = {
  item: MarketCardLike;
  freshness: FreshnessItemLike[];
};

type WalletLookupResultLike =
  | {
      status: "invalid";
      address: string;
      message: string;
    }
  | {
      status: "empty";
      address: string;
      summary: {
        totalCards: number;
        estimatedFmvUsd: number;
        averageLiquidityScore: number | null;
        sourceLabel: string;
      };
      freshness: FreshnessItemLike[];
    }
  | {
      status: "ready";
      data: {
        address: string;
        summary: {
          totalCards: number;
          listedCards: number;
          unlistedCards: number;
          estimatedFmvUsd: number;
          averageLiquidityScore: number | null;
          bundleOpportunityCount: number;
          intentMatchCount: number;
          sourceLabel: string;
        };
        actions: {
          title: string;
          confidence: ConfidenceLabel;
        }[];
        freshness: FreshnessItemLike[];
      };
    };

type IntentBoardLike = {
  generatedAt: string;
  health: {
    activeIntents: number;
    matchedCards: number;
    highConfidenceMatches: number;
    mockData: boolean;
  };
  intents: {
    id: string;
    queryText: string;
    status: string;
    sourceLabel: string;
    matches: {
      matchScore: number;
      confidence: ConfidenceLabel;
      card: {
        tokenId: string;
        name: string;
      } | null;
    }[];
  }[];
};

type BundleOverviewLike = {
  generatedAt: string;
  health: {
    totalBundles: number;
    highConfidenceBundles: number;
    detectedCards: number;
    mockData: boolean;
  };
  bundles: {
    id: string;
    name: string;
    score: number;
    confidence: ConfidenceLabel;
    itemCount: number;
    summary: string;
    items: {
      tokenId: string;
      card: {
        tokenId: string;
        name: string;
        ownerUsername: string | null;
      } | null;
    }[];
  }[];
};

type PackMomentumOverviewLike = {
  generatedAt: string;
  disclaimer: string;
  health: {
    totalPacks: number;
    totalPulls: number;
    pulls24h: number;
    latestPulledAt: string | null;
    stalePacks: number;
    mockData: boolean;
  };
  packs: {
    packName: string;
    packSlug: string;
    pulls24h: number;
    totalPulls: number;
    fmvPulled24h: number;
    freshness: FreshnessStatus;
    sourceLabel: string;
  }[];
};

export type AtlasDiscordDataProvider = {
  getMarketOverview(): Promise<MarketOverviewLike>;
  getCardDetail(tokenId: string): Promise<CardDetailLike | null>;
  getWalletCopilot(address: string): Promise<WalletLookupResultLike>;
  getIntentBoard(): Promise<IntentBoardLike>;
  getBundleOverview(): Promise<BundleOverviewLike>;
  getPackMomentumOverview(): Promise<PackMomentumOverviewLike>;
};

export type AtlasDiscordContext = {
  appUrl: string;
};

function appLink(context: AtlasDiscordContext, path: string): string {
  return new URL(path, context.appUrl).toString();
}

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}

function score(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "n/a" : Math.round(value).toString();
}

function freshnessSummary(freshness: readonly FreshnessItemLike[]): string {
  if (freshness.length === 0) return "missing";
  const stale = freshness.find((item) => item.status === "stale");
  const missing = freshness.find((item) => item.status === "missing");
  const selected = stale ?? missing ?? freshness[0];
  return selected == null ? "missing" : `${selected.status} (${selected.source})`;
}

function newestLabel(value: string | null | undefined): string {
  if (value == null) return "missing";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "missing" : date.toISOString().slice(0, 10);
}

function commandHeading(label: string): string {
  return `**Atlas ${label}**`;
}

async function cardFromQuery(provider: AtlasDiscordDataProvider, query: string): Promise<CardDetailLike | null> {
  const exact = await provider.getCardDetail(query);
  if (exact != null) return exact;

  const lowerQuery = query.toLowerCase();
  const market = await provider.getMarketOverview();
  const match = market.cards.find((card) => {
    const haystack = `${card.tokenId} ${card.name}`.toLowerCase();
    return haystack.includes(lowerQuery);
  });

  return match == null ? null : provider.getCardDetail(match.tokenId);
}

async function marketResponse(provider: AtlasDiscordDataProvider, context: AtlasDiscordContext) {
  const market = await provider.getMarketOverview();
  const confidence = market.health.mockData ? "medium" : "high";
  return `${commandHeading("Market")}
${market.health.totalCards} cards, ${market.health.listedCards} listed, ${market.health.underFmvCount} under FMV, ${market.health.externalMismatchCount} comp mismatches.
Liquidity avg: ${score(market.health.averageLiquidityScore)} · Confidence: ${confidence} · Freshness: ${market.health.freshness}
Open: ${appLink(context, "/market")}`;
}

async function cardResponse(provider: AtlasDiscordDataProvider, context: AtlasDiscordContext, query: string | null) {
  if (query == null) {
    return `${commandHeading("Card")}
Pass a token ID or search text. Open: ${appLink(context, "/market")}`;
  }

  const detail = await cardFromQuery(provider, query);
  if (detail == null) {
    return `${commandHeading("Card")}
No card found for "${query}". Freshness: missing · Open: ${appLink(context, "/market")}`;
  }

  const card = detail.item;
  const risk = card.riskFlags.slice(0, 2).join(", ") || "none";
  const demand = card.scores.demand?.value;
  const compConfidence =
    card.externalCompConfidenceScore ??
    (card.externalComps.length === 0 ? null : Math.max(...card.externalComps.map((comp) => comp.matchConfidence)));

  return `${commandHeading("Card")}
${card.name} (${card.tokenId}) · ${card.status}
Ask ${money(card.askPriceUsd)} · FMV ${money(card.fmvUsd)} · Liquidity ${score(card.liquidityScore)} · Deal ${score(card.dealScore)}
Confidence: ${card.confidence} · Freshness: ${freshnessSummary(detail.freshness)} · Demand ${score(demand)} · Comp ${score(compConfidence)} · Risk: ${risk}
Open: ${appLink(context, `/cards/${encodeURIComponent(card.tokenId)}`)}`;
}

async function walletResponse(provider: AtlasDiscordDataProvider, context: AtlasDiscordContext, address: string | null) {
  if (address == null) {
    return `${commandHeading("Wallet")}
Pass an EVM address. Atlas is read-only and never requests signatures. Open: ${appLink(context, "/market")}`;
  }

  const wallet = await provider.getWalletCopilot(address);
  if (wallet.status === "invalid") {
    return `${commandHeading("Wallet")}
${wallet.message} Open: ${appLink(context, "/market")}`;
  }

  if (wallet.status === "empty") {
    return `${commandHeading("Wallet")}
${wallet.address}: no indexed holdings. Confidence: low · Freshness: ${freshnessSummary(wallet.freshness)}
Open: ${appLink(context, `/wallet/${encodeURIComponent(wallet.address)}`)}`;
  }

  const { summary, actions } = wallet.data;
  const topAction = actions[0];
  const topActionText = topAction == null ? "Watch for new evidence" : `${topAction.title} (${topAction.confidence})`;

  return `${commandHeading("Wallet")}
${summary.totalCards} cards · ${summary.listedCards} listed · ${summary.unlistedCards} unlisted · FMV ${money(summary.estimatedFmvUsd)}
Bundles ${summary.bundleOpportunityCount} · Intent matches ${summary.intentMatchCount} · Liquidity avg ${score(summary.averageLiquidityScore)}
Top action: ${topActionText} · Freshness: ${freshnessSummary(wallet.data.freshness)}
Open: ${appLink(context, `/wallet/${encodeURIComponent(wallet.data.address)}`)}`;
}

async function intentResponse(provider: AtlasDiscordDataProvider, context: AtlasDiscordContext, query: string | null) {
  const board = await provider.getIntentBoard();
  const lowerQuery = query?.toLowerCase();
  const intents =
    lowerQuery == null
      ? board.intents
      : board.intents.filter((intent) => intent.queryText.toLowerCase().includes(lowerQuery));
  const topIntent = intents
    .filter((intent) => intent.status === "active")
    .sort((left, right) => (right.matches[0]?.matchScore ?? 0) - (left.matches[0]?.matchScore ?? 0))[0];
  const topMatch = topIntent?.matches[0];
  const topLine =
    topIntent == null
      ? "No matching active intent."
      : `${topIntent.queryText}: ${topMatch?.card?.name ?? "no card match"} (${score(topMatch?.matchScore)}, ${topMatch?.confidence ?? "low"})`;

  return `${commandHeading("Intent")}
${board.health.activeIntents} active · ${board.health.matchedCards} matched cards · ${board.health.highConfidenceMatches} high-confidence matches
Top: ${topLine} · Freshness: ${newestLabel(board.generatedAt)}
Open: ${appLink(context, "/intents")}`;
}

async function bundleResponse(provider: AtlasDiscordDataProvider, context: AtlasDiscordContext, query: string | null) {
  const overview = await provider.getBundleOverview();
  const lowerQuery = query?.toLowerCase();
  const bundles =
    lowerQuery == null
      ? overview.bundles
      : overview.bundles.filter((bundle) => {
          const haystack = [
            bundle.id,
            bundle.name,
            bundle.summary,
            ...bundle.items.flatMap((item) => [item.tokenId, item.card?.name ?? "", item.card?.ownerUsername ?? ""])
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(lowerQuery);
        });
  const topBundle = [...bundles].sort((left, right) => right.score - left.score)[0];
  const topLine =
    topBundle == null
      ? "No matching bundle yet."
      : `${topBundle.name}: ${topBundle.itemCount} cards, score ${score(topBundle.score)}, ${topBundle.confidence} confidence`;

  return `${commandHeading("Bundle")}
${overview.health.totalBundles} bundles · ${overview.health.highConfidenceBundles} high-confidence · ${overview.health.detectedCards} cards detected
Top: ${topLine} · Freshness: ${newestLabel(overview.generatedAt)}
Open: ${appLink(context, "/bundles")}`;
}

async function packResponse(provider: AtlasDiscordDataProvider, context: AtlasDiscordContext, packSlug: string | null) {
  const overview = await provider.getPackMomentumOverview();
  const packs = packSlug == null ? overview.packs : overview.packs.filter((pack) => pack.packSlug === packSlug);
  const topPack = [...packs].sort((left, right) => right.pulls24h - left.pulls24h)[0];
  const topLine =
    topPack == null
      ? "No matching pack activity."
      : `${topPack.packName}: ${topPack.pulls24h} pulls/24h, ${topPack.totalPulls} total, ${money(topPack.fmvPulled24h)} FMV/24h, ${topPack.freshness}`;

  return `${commandHeading("Pack")}
${overview.health.totalPacks} packs · ${overview.health.totalPulls} pulls · ${overview.health.pulls24h} pulls/24h · Latest ${newestLabel(overview.health.latestPulledAt)}
Top: ${topLine}
Observed activity only, not official odds. Open: ${appLink(context, "/packs")}`;
}

export async function handleAtlasInteraction(
  interaction: DiscordInteraction,
  provider: AtlasDiscordDataProvider,
  context: AtlasDiscordContext
): Promise<DiscordInteractionResponse> {
  if (interaction.data?.name !== "atlas") {
    return messageResponse(`Unsupported command. Open: ${appLink(context, "/market")}`);
  }

  const command = getAtlasSubcommand(interaction);
  const content =
    command.name === "market"
      ? await marketResponse(provider, context)
      : command.name === "card"
        ? await cardResponse(provider, context, stringOption(command.options, "query"))
        : command.name === "wallet"
          ? await walletResponse(provider, context, stringOption(command.options, "address"))
          : command.name === "intent"
            ? await intentResponse(provider, context, stringOption(command.options, "query"))
            : command.name === "bundle"
              ? await bundleResponse(provider, context, stringOption(command.options, "query"))
              : command.name === "pack"
                ? await packResponse(provider, context, stringOption(command.options, "pack"))
                : `Choose /atlas market, card, wallet, intent, bundle, or pack. Open: ${appLink(context, "/market")}`;

  return messageResponse(content);
}
