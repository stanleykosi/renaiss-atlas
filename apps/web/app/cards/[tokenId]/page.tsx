import Link from "next/link";
import { notFound } from "next/navigation";
import type { AiCardMemoResult } from "@renaiss/ai";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Database,
  FileSearch,
  ShieldCheck,
  Sparkles
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  formatUsdCents,
  getRenaissOsCardIntelligence,
  officialSourceSummary
} from "@/lib/renaiss-os/data";
import { cn } from "@/lib/utils";

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

function formatPct(value: number | null | undefined) {
  if (value == null) return "N/A";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatScore(value: number) {
  return value.toFixed(0);
}

export default async function CardDetailPage({ params }: CardDetailPageProps) {
  const { tokenId } = await params;
  const intelligence = await getRenaissOsCardIntelligence(decodeURIComponent(tokenId));

  if (intelligence == null) {
    notFound();
  }

  const { card, trades, fmvSeries, scores, memo } = intelligence;
  const topSources = card.sourceBreakdown.slice(0, 8);
  const recentFmv = fmvSeries.points.slice(-8).reverse();

  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-5 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/cards" className={cn(buttonVariants({ variant: "ghost", className: "-ml-2 h-8 px-2" }))}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Search
            </Link>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={card.confidence === "prime" || card.confidence === "high" ? "default" : "secondary"}>
                {card.confidence ?? "unknown"} confidence
              </Badge>
              <Badge variant="outline">{card.gradeLabel}</Badge>
              <Badge variant="secondary">Renaiss OS Index</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">{card.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {card.setName ?? "Unknown set"} #{card.cardNumber ?? "N/A"} · {card.language ?? "Unknown language"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[560px]">
            <HeaderMetric label="FMV" value={formatUsdCents(card.priceUsdCents)} />
            <HeaderMetric label="Sources" value={String(card.sourceCount ?? 0)} />
            <HeaderMetric label="Observations" value={String(card.observationCount ?? 0)} />
            <HeaderMetric label="Last sale" value={formatDate(card.lastSaleAt)} />
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                  <CardTitle>Official Price Panel</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-4">
                  <Metric label="Current FMV" value={formatUsdCents(card.priceUsdCents)} />
                  <Metric label="7d" value={formatPct(card.deltas.d7)} />
                  <Metric label="30d" value={formatPct(card.deltas.d30)} />
                  <Metric label="365d" value={formatPct(card.deltas.d365)} />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{officialSourceSummary(card)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
                  <CardTitle>Atlas Scores From Official Evidence</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {scores.map((score) => (
                    <article key={score.label} className="rounded-md border bg-secondary/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium capitalize">{score.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{score.reasons[0]}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xl font-semibold">{formatScore(score.value)}</p>
                          <Badge variant={score.confidence === "high" ? "default" : "secondary"}>
                            {score.confidence}
                          </Badge>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" aria-hidden="true" />
                  <CardTitle>Source Breakdown</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {topSources.length === 0 ? (
                  <EmptyState title="No source breakdown" detail="The official response has no source rows for this card yet." />
                ) : (
                  <div className="grid gap-3">
                    {topSources.map((source) => (
                      <article key={source.source} className="rounded-md border bg-secondary/30 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{source.displayName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {source.category ?? source.bucket ?? "source"} · {source.count} observations
                            </p>
                          </div>
                          <p className="font-mono text-sm">{formatUsdCents(source.medianUsdCents)}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>FMV Series</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {recentFmv.map((point) => (
                      <Metric key={point.t} label={`${formatDate(point.t)} · n=${point.n}`} value={formatUsdCents(point.usdCents)} />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Official Trades</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {trades.slice(0, 8).map((trade) => (
                      <Metric
                        key={`${trade.source}:${trade.observedAt}:${trade.priceUsdCents}`}
                        label={`${trade.displayName} · ${trade.kind}`}
                        value={formatUsdCents(trade.priceUsdCents)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <AiMemoPanel memo={memo} />

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
                  Lookup uses `/v1/graded/:cert` through the Atlas backend proxy. No wallet signature or private key is ever requested.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                  <CardTitle>Safety Boundary</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">
                  Atlas uses official Renaiss OS evidence, deterministic scores before AI, schema-validated AI output, and source citations. It does not predict guaranteed upside, execute trades, collect keys, request approvals, or custody assets.
                </p>
                <Link href="/sources" className={cn(buttonVariants({ variant: "secondary", className: "mt-4 w-fit" }))}>
                  Open data policy
                </Link>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}

function AiMemoPanel({ memo }: { memo: AiCardMemoResult }) {
  const output = memo.output;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            <CardTitle>AI Deal Memo</CardTitle>
          </div>
          <Badge variant={output.confidence === "high" ? "default" : "secondary"}>{output.confidence}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border bg-secondary/30 p-3">
          <p className="text-sm font-medium">{output.nextAction.label}</p>
          <p className="mt-2 text-sm text-muted-foreground">{output.recommendation}</p>
        </div>
        <section className="mt-4">
          <h3 className="text-xs font-medium uppercase text-muted-foreground">Evidence</h3>
          <ul className="mt-2 grid gap-2">
            {output.evidence.map((item) => (
              <li key={item} className="rounded-md border bg-card px-3 py-2 text-sm">
                {item}
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-4">
          <h3 className="text-xs font-medium uppercase text-muted-foreground">Risks</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {output.risks.map((risk) => (
              <Badge key={risk} variant="outline">
                {risk}
              </Badge>
            ))}
          </div>
        </section>
        <section className="mt-4">
          <h3 className="text-xs font-medium uppercase text-muted-foreground">Sources</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {output.sourcesUsed.map((source) => (
              <Badge key={source} variant="secondary" className="font-mono">
                {source.length > 28 ? `${source.slice(0, 18)}...` : source}
              </Badge>
            ))}
          </div>
        </section>
        <p className="mt-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          {output.disclaimer}
        </p>
      </CardContent>
    </Card>
  );
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

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border bg-secondary/30 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
