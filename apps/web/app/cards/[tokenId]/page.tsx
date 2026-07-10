import Link from "next/link";
import { notFound } from "next/navigation";
import type { RiskFlag } from "@renaiss/core";
import { ArrowLeft, BadgeCheck, BarChart3, FileSearch, ShieldCheck } from "lucide-react";

import { CardArtwork } from "@/components/card-artwork";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  decodeRenaissOsCardToken,
  formatUsdCents,
  getRenaissOsCardIntelligence,
  type RenaissOsCardIntelligence
} from "@/lib/renaiss-os/data";
import { formatGradeLabel } from "@/lib/renaiss-os/display";
import { cn } from "@/lib/utils";

import { CollectorBriefCard } from "./collector-brief-card";

const RISK_FLAG_LABELS = {
  official_confidence_low: "Low confidence",
  official_observations_missing: "Missing official observations",
  single_source_evidence: "Single-source evidence",
  stale_last_sale: "Stale last sale",
  trade_activity_missing: "No recent trade rows"
} satisfies Record<RiskFlag, string>;

type CardDetailPageProps = {
  params: Promise<{ tokenId: string }>;
};

function formatDate(value: string | null | undefined) {
  if (value == null) return "Missing";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (value == null) return "Missing";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatPct(value: number | null | undefined) {
  if (value == null) return "N/A";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatScore(value: number) {
  return value.toFixed(0);
}

function confidenceText(value: RenaissOsCardIntelligence["card"]["confidence"]) {
  return value ?? "unknown";
}

export default async function CardDetailPage({ params }: CardDetailPageProps) {
  const { tokenId } = await params;
  const path = decodeRenaissOsCardToken(tokenId);
  if (path == null) notFound();
  const intelligence = await getRenaissOsCardIntelligence(path);

  const { card, trades, fmvSeries, scores } = intelligence;
  const recentFmv = fmvSeries.points.slice(-8).reverse();

  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="grid gap-5 border-b pb-5 lg:grid-cols-[150px_minmax(0,1fr)_460px] lg:items-end">
          <CardArtwork
            src={card.imageUrlLg ?? card.imageUrl}
            alt={`${card.name} card image`}
            className="order-2 w-32 lg:order-1 lg:w-full"
            loading="eager"
          />

          <div className="order-1 lg:order-2">
            <Link
              href="/cards"
              className={cn(buttonVariants({ variant: "ghost", className: "-ml-2 h-8 px-2" }))}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Search
            </Link>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal">{card.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {card.setName ?? "Unknown set"} #{card.cardNumber ?? "N/A"} ·{" "}
              {card.language ?? "Unknown language"}
            </p>
          </div>

          <div className="order-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[460px]">
            <HeaderMetric label="FMV" value={formatUsdCents(card.priceUsdCents)} />
            <HeaderMetric label="Renaiss confidence" value={confidenceText(card.confidence)} />
            <HeaderMetric label="Last sale" value={formatDate(card.lastSaleAt)} />
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                  <CardTitle>Price Panel</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-4">
                  <Metric label="Current FMV" value={formatUsdCents(card.priceUsdCents)} />
                  <Metric label="7d" value={formatPct(card.deltas.d7)} />
                  <Metric label="30d" value={formatPct(card.deltas.d30)} />
                  <Metric label="365d" value={formatPct(card.deltas.d365)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
                  <CardTitle>Atlas Scores</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {scores.map((score) => (
                    <article key={score.label} className="rounded-md border bg-secondary/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium capitalize">{score.label}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {scoreDescription(score.label)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xl font-semibold">
                            {formatScore(score.value)}
                          </p>
                          <Badge variant={score.confidence === "high" ? "default" : "secondary"}>
                            {score.confidence}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        {score.reasons[0]}
                      </p>
                      {score.riskFlags.length === 0 ? null : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {score.riskFlags.map((flag) => (
                            <Badge key={flag} variant="outline">
                              {riskFlagLabel(flag)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </CardContent>
            </Card>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>FMV History</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Daily fair-market-value points with the number of Renaiss records behind each
                    point.
                  </p>
                </CardHeader>
                <CardContent>
                  {recentFmv.length === 0 ? (
                    <EmptyState
                      title="No FMV history yet"
                      detail="Renaiss returned no FMV history points for this card."
                    />
                  ) : (
                    <FmvHistoryList points={recentFmv} />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Trades & Listings</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Recent Renaiss trade-history rows with observed dates.
                  </p>
                </CardHeader>
                <CardContent>
                  {trades.length === 0 ? (
                    <EmptyState
                      title="No recent trade rows"
                      detail="Renaiss returned no recent trade rows for this card."
                    />
                  ) : (
                    <TradeHistoryList trades={trades.slice(0, 8)} fallbackGrade={card.gradeLabel} />
                  )}
                </CardContent>
              </Card>
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <CollectorBriefCard tokenId={tokenId} />

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileSearch className="h-4 w-4 text-primary" aria-hidden="true" />
                  <CardTitle>Graded Cert Lookup</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <form action="/graded" className="flex flex-col gap-3 sm:flex-row">
                  <Input name="cert" placeholder="PSA cert number" />
                  <button className={cn(buttonVariants(), "sm:w-36")} type="submit">
                    Lookup
                  </button>
                </form>
                <p className="mt-3 text-xs text-muted-foreground">
                  Lookup uses `/v1/graded/:cert` through the Atlas backend proxy. No wallet
                  signature or private key is ever requested.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                  <CardTitle>Read-only Boundary</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">
                  Atlas uses Renaiss API data and deterministic scores before AI. It does not
                  predict guaranteed upside, execute trades, collect keys, request approvals, or
                  custody assets.
                </p>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}

function scoreDescription(label: RenaissOsCardIntelligence["scores"][number]["label"]) {
  if (label === "Market activity") {
    return "How active this card looks from recent sales, listings, and last-sale recency.";
  }
  if (label === "FMV reliability") {
    return "How dependable the current FMV appears after weighing confidence, record coverage, and recency.";
  }
  if (label === "Liquidity") {
    return "How much market signal exists to evaluate the card from trades, FMV history, and confidence.";
  }
  return "A deterministic reading of Renaiss data.";
}

function riskFlagLabel(flag: RiskFlag) {
  return RISK_FLAG_LABELS[flag];
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-secondary/30 px-3 py-2 text-sm">
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function fmvRecordLabel(count: number) {
  if (count === 0) return "No new records";
  if (count === 1) return "1 record";
  return `${count} records`;
}

function tradeKindLabel(kind: RenaissOsCardIntelligence["trades"][number]["kind"]) {
  return kind === "transaction" ? "Sale" : "Listing";
}

function tradeDetail(
  detail: string | null | undefined,
  grade: {
    company?: string | null | undefined;
    grade?: string | null | undefined;
    gradeLabel?: string | null | undefined;
  }
) {
  const displayGrade = formatGradeLabel(grade);
  const usableGrade = displayGrade === "Unknown grade" ? null : displayGrade;
  const parts = [usableGrade, detail].filter(
    (part): part is string => part != null && part.trim().length > 0
  );
  return parts.join(" · ");
}

function FmvHistoryList({ points }: { points: RenaissOsCardIntelligence["fmvSeries"]["points"] }) {
  return (
    <div className="grid gap-2">
      {points.map((point) => (
        <article
          key={point.t}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border bg-secondary/30 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{formatDate(point.t)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{fmvRecordLabel(point.n)}</p>
          </div>
          <p className="font-mono text-sm font-semibold">{formatUsdCents(point.usdCents)}</p>
        </article>
      ))}
    </div>
  );
}

function TradeHistoryList({
  trades,
  fallbackGrade
}: {
  trades: RenaissOsCardIntelligence["trades"];
  fallbackGrade: string;
}) {
  return (
    <div className="grid gap-2">
      {trades.map((trade) => {
        const detail = tradeDetail(trade.detail, {
          company: trade.company,
          grade: trade.grade,
          gradeLabel: trade.gradeLabel ?? fallbackGrade
        });

        return (
          <article
            key={`${trade.source}:${trade.observedAt}:${trade.priceUsdCents}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border bg-secondary/30 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{tradeKindLabel(trade.kind)}</p>
                <Badge variant={trade.kind === "transaction" ? "default" : "secondary"}>
                  {trade.kind === "transaction" ? "completed" : "active"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Observed {formatDateTime(trade.observedAt)}
              </p>
              {detail.length === 0 ? null : (
                <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
              )}
            </div>
            <p className="font-mono text-sm font-semibold">{formatUsdCents(trade.priceUsdCents)}</p>
          </article>
        );
      })}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border bg-secondary/30 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
