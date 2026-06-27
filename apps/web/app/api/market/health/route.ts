import { NextResponse } from "next/server";
import { z } from "zod";

import { getMarketOverview } from "@/lib/market-data";

const MarketHealthQuerySchema = z.object({
  tcg: z.string().trim().optional(),
  status: z.enum(["listed", "unlisted", "unknown"]).optional()
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = MarketHealthQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!query.success) {
    return NextResponse.json({ error: "Invalid market health query." }, { status: 400 });
  }

  const overview = await getMarketOverview();
  const cards = overview.cards.filter((card) => {
    if (query.data.tcg != null && card.tcg !== query.data.tcg) return false;
    if (query.data.status != null && card.status !== query.data.status) return false;
    return true;
  });

  if (cards.length === overview.cards.length) {
    return NextResponse.json(overview.health);
  }

  const listedCards = cards.filter((card) => card.status === "listed").length;
  const lastObservedAt =
    cards
      .map((card) => card.observedAt)
      .filter((value): value is string => value != null)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;

  return NextResponse.json({
    ...overview.health,
    totalCards: cards.length,
    listedCards,
    unlistedCards: cards.filter((card) => card.status === "unlisted").length,
    totalAskUsd: cards.reduce((sum, card) => sum + (card.askPriceUsd ?? 0), 0),
    totalFmvUsd: cards.reduce((sum, card) => sum + (card.fmvUsd ?? 0), 0),
    underFmvCount: cards.filter((card) => card.dealDeltaPct != null && card.dealDeltaPct > 0).length,
    externalMismatchCount: cards.filter((card) =>
      card.externalComps.some((comp) => comp.rejected)
    ).length,
    staleCards: cards.filter((card) => card.freshness === "stale").length,
    lastObservedAt
  });
}
