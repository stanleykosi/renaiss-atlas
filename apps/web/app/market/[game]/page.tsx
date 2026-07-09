import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { CardArtwork } from "@/components/card-artwork";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  atlasCardHref,
  formatUsdCents,
  getRenaissOsIndexDetail
} from "@/lib/renaiss-os/data";
import { formatGradeLabel, gradeLabelTitle } from "@/lib/renaiss-os/display";
import { cn } from "@/lib/utils";

type MarketIndexPageProps = {
  params: Promise<{ game: string }>;
};

function formatPct(value: number | null) {
  if (value == null) return "N/A";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatDate(value: string | null | undefined) {
  if (value == null) return "Missing";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function formatIndexLevel(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(value);
}

export default async function MarketIndexPage({ params }: MarketIndexPageProps) {
  const { game } = await params;
  const index = await getRenaissOsIndexDetail(decodeURIComponent(game));

  if (index == null) {
    notFound();
  }

  const heroCard = index.constituents.find((card) => (card.imageUrlThumb ?? card.imageUrl) != null) ?? null;

  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="grid gap-5 border-b pb-5 lg:grid-cols-[128px_minmax(0,1fr)_minmax(280px,420px)] lg:items-end">
          <CardArtwork
            src={heroCard?.imageUrlThumb ?? heroCard?.imageUrl}
            alt={`${index.label} representative card image`}
            className="order-2 w-28 bg-secondary/30 lg:order-1 lg:w-full"
            loading="eager"
          />

          <div className="order-1 lg:order-2">
            <Link href="/market" className={cn(buttonVariants({ variant: "ghost", className: "-ml-2 h-8 px-2" }))}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Market pulse
            </Link>
            <p className="mt-4 font-mono text-xs text-primary uppercase">Index entries</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">{index.label}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              The ranked entries Renaiss currently uses to calculate this index. Each entry is a specific card and grade.
            </p>
          </div>

          <div className="order-3 grid grid-cols-2 gap-3">
            <Metric label="Index score" value={formatIndexLevel(index.value)} />
            <Metric label="Index entries" value={String(index.constituentCount)} />
            <Metric label="30d move" value={formatPct(index.deltas.d30)} />
            <Metric label="Update cycle" value={index.rebalance} />
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Index Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {index.constituents.map((card) => (
                <Link
                  key={card.href}
                  href={atlasCardHref(card)}
                  className="grid grid-cols-[52px_48px_minmax(0,1fr)] gap-3 rounded-md border bg-secondary/30 p-3 transition-colors hover:bg-secondary md:grid-cols-[52px_56px_minmax(0,1fr)_110px_90px_120px]"
                >
                  <div className="flex items-center">
                    <Badge variant="outline" className="font-mono">
                      #{card.rank}
                    </Badge>
                  </div>
                  <CardArtwork
                    src={card.imageUrlThumb ?? card.imageUrl}
                    alt={`${card.name} card image`}
                    className="w-12 bg-card md:w-14"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{card.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {card.setCode ?? card.setName ?? "Unknown set"} #{card.cardNumber ?? "N/A"} ·{" "}
                      <span title={gradeLabelTitle({ gradeLabel: card.grade })}>
                        {formatGradeLabel({ gradeLabel: card.grade })}
                      </span>
                    </p>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-xs text-muted-foreground">FMV</p>
                    <p className="mt-1 font-mono text-sm">{formatUsdCents(card.priceUsdCents)}</p>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-xs text-muted-foreground">30d</p>
                    <p className="mt-1 font-mono text-sm">{formatPct(card.deltaPct)}</p>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-xs text-muted-foreground">Last sale</p>
                    <p className="mt-1 text-sm">{formatDate(card.lastSaleAt)}</p>
                  </div>
                  <div className="col-span-3 flex items-center justify-between gap-3 md:hidden">
                    <span className="font-mono text-sm">{formatUsdCents(card.priceUsdCents)}</span>
                    <span className="font-mono text-xs text-muted-foreground">{formatPct(card.deltaPct)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Link href="/cards" className={cn(buttonVariants({ variant: "secondary", className: "w-fit" }))}>
          Search another card
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}
