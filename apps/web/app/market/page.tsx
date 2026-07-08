import Link from "next/link";
import { ArrowRight, Database, Search, ShieldCheck, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  atlasCardHref,
  formatUsdCents,
  getRenaissOsMarketPulse
} from "@/lib/renaiss-os/data";
import { cn } from "@/lib/utils";

function formatPct(value: number | null) {
  if (value == null) return "N/A";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatDate(value: string | null | undefined) {
  if (value == null) return "Missing";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export default async function MarketPage() {
  const pulse = await getRenaissOsMarketPulse();

  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs text-primary uppercase">Market Pulse</p>
            <h1 className="mt-2 text-3xl font-semibold">Renaiss OS Index Intelligence</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Official index tiles, featured movers, and recent public trades. Atlas adds read-only scoring and source-cited memos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/sources" className={cn(buttonVariants({ variant: "secondary" }))}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Sources & safety
            </Link>
            <Link href="/" className={cn(buttonVariants({ variant: "ghost" }))}>
              Home
            </Link>
          </div>
        </header>

        <form action="/cards" className="rounded-md border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input name="q" className="pl-9" placeholder="Search card, set, character, or cert target" />
            </div>
            <button className={cn(buttonVariants(), "md:w-40")} type="submit">
              Search card
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </form>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pulse.indices.map((index) => (
            <Card key={index.game}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{index.label}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">Updated {formatDate(index.updatedAt)}</p>
                  </div>
                  <Badge variant={index.deltas.d30 == null || index.deltas.d30 >= 0 ? "default" : "warning"}>
                    {formatPct(index.deltas.d30)} 30d
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-3xl font-semibold">{index.value.toFixed(2)}</p>
                <div className="mt-4 grid gap-2 text-sm">
                  <Metric label="Constituents" value={String(index.constituentCount)} />
                  <Metric label="Rebalance" value={index.rebalance} />
                  <Metric label="7d" value={formatPct(index.deltas.d7)} />
                </div>
                <div className="mt-4 grid gap-2">
                  {index.topMovers.slice(0, 3).map((mover) => (
                    <Link
                      key={`${index.game}:${mover.href}`}
                      href={atlasCardHref(mover)}
                      className="rounded-md border bg-secondary/30 px-3 py-2 text-sm transition-colors hover:bg-secondary"
                    >
                      <span className="font-medium">{mover.name}</span>
                      <span className="ml-2 text-muted-foreground">{formatPct(mover.deltaPct)}</span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
                <CardTitle>Featured Movers</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {pulse.featured.map((card) => (
                  <Link
                    key={card.href}
                    href={atlasCardHref(card)}
                    className="grid grid-cols-[64px_1fr] gap-3 rounded-md border bg-secondary/30 p-3 transition-colors hover:bg-secondary"
                  >
                    {(card.imageUrlThumb ?? card.imageUrl) == null ? (
                      <div className="grid aspect-square place-items-center rounded-md border bg-card">
                        <Database className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </div>
                    ) : (
                      <img
                        src={card.imageUrlThumb ?? card.imageUrl ?? ""}
                        alt=""
                        className="aspect-square rounded-md border object-cover"
                      />
                    )}
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={card.confidence === "high" || card.confidence === "prime" ? "default" : "secondary"}>
                          {card.confidence ?? "unknown"}
                        </Badge>
                        <Badge variant="outline">{card.gradeLabel}</Badge>
                      </div>
                      <p className="mt-2 text-sm font-medium">{card.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {card.setCode ?? card.setName ?? "Unknown set"} #{card.cardNumber ?? "N/A"}
                      </p>
                      <p className="mt-2 font-mono text-sm">{formatUsdCents(card.priceUsdCents)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {pulse.recentTrades.map((trade) => (
                  <Link
                    key={trade.id}
                    href={atlasCardHref(trade.card)}
                    className="rounded-md border bg-secondary/30 p-3 transition-colors hover:bg-secondary"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{trade.card.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {trade.displayName} · {formatDate(trade.observedAt)}
                        </p>
                      </div>
                      <Badge variant={trade.kind === "transaction" ? "default" : "secondary"}>{trade.kind}</Badge>
                    </div>
                    <p className="mt-2 font-mono text-sm">{formatUsdCents(trade.priceUsdCents)}</p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-secondary/30 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
