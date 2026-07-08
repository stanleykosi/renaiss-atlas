import Link from "next/link";
import { ArrowRight, Database, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  atlasCardHref,
  formatUsdCents,
  searchRenaissOsCards
} from "@/lib/renaiss-os/data";
import { cn } from "@/lib/utils";

type CardsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

function formatPct(value: number | null) {
  if (value == null) return "N/A";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export default async function CardsPage({ searchParams }: CardsPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const results = await searchRenaissOsCards(query);

  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs text-primary uppercase">Search Card</p>
            <h1 className="mt-2 text-3xl font-semibold">Official Card Search</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Search Renaiss OS Index cards, then open source-backed card intelligence and AI memo evidence.
            </p>
          </div>
          <Link href="/market" className={cn(buttonVariants({ variant: "secondary" }))}>
            Market pulse
          </Link>
        </header>

        <form action="/cards" className="rounded-md border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input name="q" defaultValue={query} className="pl-9" placeholder="Charizard, Nami, Pikachu, set name..." />
            </div>
            <button className={cn(buttonVariants(), "md:w-40")} type="submit">
              Search
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </form>

        {query.length === 0 ? (
          <EmptyState
            title="Start with a card search"
            detail="Try a character, card name, set, or card number to begin the official demo path."
          />
        ) : results.results.length === 0 ? (
          <EmptyState
            title="No official matches"
            detail="Renaiss OS returned no cards for that query. Try a broader card or character name."
          />
        ) : (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {results.results.map((card) => (
              <Link
                key={card.href}
                href={atlasCardHref(card)}
                className="grid grid-cols-[76px_1fr] gap-3 rounded-md border bg-card p-3 transition-colors hover:bg-secondary"
              >
                {(card.imageUrlThumb ?? card.imageUrl) == null ? (
                  <div className="grid aspect-square place-items-center rounded-md border bg-secondary">
                    <Database className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                ) : (
                  <img
                    src={card.imageUrlThumb ?? card.imageUrl ?? ""}
                    alt=""
                    className="aspect-square rounded-md border object-cover"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={card.confidence === "prime" || card.confidence === "high" ? "default" : "secondary"}>
                      {card.confidence ?? "unknown"}
                    </Badge>
                    <Badge variant="outline">{card.gradeLabel}</Badge>
                  </div>
                  <h2 className="mt-2 truncate text-sm font-medium">{card.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.setCode ?? card.setName ?? "Unknown set"} #{card.cardNumber ?? "N/A"}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="font-mono text-sm">{formatUsdCents(card.priceUsdCents)}</span>
                    <span className="text-xs text-muted-foreground">{formatPct(card.deltaPct)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
