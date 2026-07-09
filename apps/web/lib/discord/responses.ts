import {
  atlasCardHref,
  encodeRenaissOsCardToken,
  formatUsdCents,
  getRenaissOsCardIntelligence,
  getRenaissOsMarketPulse,
  lookupRenaissOsGradedCert,
  renaissConfidenceSummary,
  parseRenaissOsCardHref,
  searchRenaissOsCards
} from "@/lib/renaiss-os/data";
import { formatGradeLabel } from "@/lib/renaiss-os/display";

import {
  getAtlasSubcommand,
  messageResponse,
  stringOption,
  type DiscordInteraction,
  type DiscordInteractionResponse
} from "./interactions";

export type AtlasDiscordContext = {
  appUrl: string;
};

function appLink(context: AtlasDiscordContext, path: string): string {
  return new URL(path, context.appUrl).toString();
}

function dateLabel(value: string | null | undefined): string {
  if (value == null) return "missing";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "missing" : date.toISOString().slice(0, 10);
}

function deltaLabel(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function marketResponse(context: AtlasDiscordContext): Promise<DiscordInteractionResponse> {
  const pulse = await getRenaissOsMarketPulse();
  const indices = pulse.indices
    .slice(0, 3)
    .map((index) => `- ${index.label}: ${index.value.toFixed(1)} (${deltaLabel(index.deltas.d7)} 7d)`)
    .join("\n");
  const featured = pulse.featured
    .slice(0, 3)
    .map(
      (card) =>
        `- ${card.name} ${formatGradeLabel({
          company: card.company,
          grade: card.grade,
          gradeLabel: card.gradeLabel
        })}: ${formatUsdCents(card.priceUsdCents)} (${card.confidence ?? "low"})`
    )
    .join("\n");
  const freshestIndex = pulse.indices
    .map((index) => index.updatedAt)
    .filter((value): value is string => value != null)
    .sort()
    .at(-1);

  return messageResponse(
    [
      "**Atlas Market Pulse**",
      indices.length === 0 ? "No index tiles returned by Renaiss." : indices,
      featured.length === 0 ? "" : `Featured:\n${featured}`,
      `Freshness: ${dateLabel(freshestIndex)} via Renaiss OS Index API.`,
      `Open: ${appLink(context, "/market")}`
    ]
      .filter((line) => line.length > 0)
      .join("\n")
  );
}

async function cardDetailResponse(query: string, context: AtlasDiscordContext): Promise<DiscordInteractionResponse | null> {
  const path = parseRenaissOsCardHref(query);
  if (path == null) return null;

  const intelligence = await getRenaissOsCardIntelligence(path.href);
  if (intelligence == null) return null;

  const liquidityScore = intelligence.scores.find((score) => score.label === "Liquidity");
  const cardPath = `/cards/${encodeURIComponent(encodeRenaissOsCardToken(intelligence.card.href))}`;

  return messageResponse(
    [
      `**Atlas Card Intelligence: ${cleanLine(intelligence.card.name)}**`,
      `FMV: ${formatUsdCents(intelligence.card.priceUsdCents)} | Renaiss confidence: ${intelligence.card.confidence ?? "low"}`,
      renaissConfidenceSummary(intelligence.card),
      `Liquidity: ${liquidityScore == null ? "n/a" : `${Math.round(liquidityScore.value)} (${liquidityScore.confidence})`}`,
      "Collector Brief: open the card page to generate it on demand.",
      `Freshness: ${dateLabel(intelligence.card.updatedAt ?? intelligence.card.lastSaleAt)}.`,
      `Open: ${appLink(context, cardPath)}`
    ].join("\n")
  );
}

async function cardSearchResponse(query: string, context: AtlasDiscordContext): Promise<DiscordInteractionResponse> {
  const exact = await cardDetailResponse(query, context);
  if (exact != null) return exact;

  const results = await searchRenaissOsCards(query);
  if (results.results.length === 0) {
    return messageResponse(
      [`**Atlas Card Search**`, `No Renaiss OS result for "${cleanLine(query)}".`, `Open: ${appLink(context, "/cards")}`].join(
        "\n"
      )
    );
  }

  const cards = results.results
    .slice(0, 5)
    .map(
      (card, index) =>
        `${index + 1}. ${cleanLine(card.name)} ${formatGradeLabel({
          company: card.company,
          grade: card.grade,
          gradeLabel: card.gradeLabel
        })} - ${formatUsdCents(card.priceUsdCents)} (${card.confidence ?? "low"})\n${appLink(context, atlasCardHref(card))}`
    )
    .join("\n");

  return messageResponse(
    [
      `**Atlas Card Search: ${cleanLine(query)}**`,
      cards,
      "Open a result for card intelligence and an on-demand Collector Brief."
    ].join("\n")
  );
}

async function gradedResponse(cert: string, context: AtlasDiscordContext): Promise<DiscordInteractionResponse> {
  const lookup = await lookupRenaissOsGradedCert(cert);
  if (!lookup.found || lookup.card == null) {
    return messageResponse(
      [
        `**Atlas Graded Cert Lookup**`,
        `No Renaiss OS graded result for cert ${cleanLine(cert)}.`,
        `Open: ${appLink(context, `/graded?cert=${encodeURIComponent(cert)}`)}`
      ].join("\n")
    );
  }

  return messageResponse(
    [
      `**Atlas Graded Cert: ${cleanLine(lookup.certNumber)}**`,
      `${cleanLine(lookup.card.name)} ${formatGradeLabel({
        company: lookup.company ?? lookup.card.company,
        grade: lookup.grade ?? lookup.card.grade,
        gradeLabel: lookup.gradeLabel ?? lookup.card.gradeLabel
      })}`,
      `FMV: ${formatUsdCents(lookup.card.priceUsdCents)} | Confidence: ${lookup.card.confidence ?? "low"}`,
      `Freshness: ${dateLabel(lookup.card.lastSaleAt)} via Renaiss OS Index API.`,
      `Open cert: ${appLink(context, `/graded/${encodeURIComponent(cert)}`)}`,
      `Open card: ${appLink(context, atlasCardHref(lookup.card))}`
    ].join("\n")
  );
}

export async function handleAtlasDiscordInteraction(
  interaction: DiscordInteraction,
  context: AtlasDiscordContext
): Promise<DiscordInteractionResponse> {
  const subcommand = getAtlasSubcommand(interaction);

  try {
    if (subcommand.name === "market") {
      return await marketResponse(context);
    }

    if (subcommand.name === "card") {
      const query = stringOption(subcommand.options, "query");
      if (query == null) return messageResponse("Atlas card search needs a query.");
      return await cardSearchResponse(query, context);
    }

    if (subcommand.name === "graded") {
      const cert = stringOption(subcommand.options, "cert");
      if (cert == null) return messageResponse("Atlas graded lookup needs a cert number.");
      return await gradedResponse(cert, context);
    }

    return messageResponse("Use `/atlas market`, `/atlas card`, or `/atlas graded`.");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return messageResponse(
      [
        "**Atlas is temporarily unavailable**",
        `Renaiss API lookup failed: ${cleanLine(reason)}`,
        "Try again shortly or open the Vercel app."
      ].join("\n")
    );
  }
}
