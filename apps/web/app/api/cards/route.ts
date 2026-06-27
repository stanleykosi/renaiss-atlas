import { NextResponse } from "next/server";
import { z } from "zod";

import { listMarketCards } from "@/lib/market-data";
import type { MarketFilters, MarketSortKey } from "@/lib/market-types";

const CardListQuerySchema = z.object({
  q: z.string().trim().default(""),
  status: z.enum(["listed", "unlisted", "unknown", "all"]).default("all"),
  language: z.string().trim().default("all"),
  grader: z.string().trim().default("all"),
  grade: z.string().trim().default("all"),
  mismatchesOnly: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  sortBy: z
    .enum(["name", "askPriceUsd", "fmvUsd", "liquidityScore", "dealScore", "observedAt"])
    .default("liquidityScore"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = CardListQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!query.success) {
    return NextResponse.json({ error: "Invalid card list query." }, { status: 400 });
  }

  const filters: MarketFilters = {
    q: query.data.q,
    status: query.data.status,
    language: query.data.language.length > 0 ? query.data.language : "all",
    grader: query.data.grader.length > 0 ? query.data.grader : "all",
    grade: query.data.grade.length > 0 ? query.data.grade : "all",
    mismatchesOnly: query.data.mismatchesOnly,
    sortBy: query.data.sortBy as MarketSortKey,
    sortDir: query.data.sortDir
  };

  return NextResponse.json(
    await listMarketCards({
      filters,
      page: query.data.page,
      pageSize: query.data.pageSize
    })
  );
}
