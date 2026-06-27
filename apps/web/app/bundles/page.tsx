import Link from "next/link";
import type { ReactNode } from "react";
import { Boxes, CheckCircle2, Database, DollarSign, Layers3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBundleOverview } from "@/lib/bundle-data";
import type { BundleView } from "@/lib/bundle-types";
import { cn } from "@/lib/utils";

function formatMoney(value: number | null) {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatScore(value: number | null | undefined) {
  if (value == null) return "N/A";
  return value.toFixed(0);
}

function formatType(value: string) {
  return value.replaceAll("_", " ");
}

export default async function BundlesPage() {
  const overview = await getBundleOverview();

  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs text-primary uppercase">Bundles</p>
            <h1 className="mt-2 text-3xl font-semibold">Bundle Explorer</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Deterministic bundle candidates grouped by certification, card identity, collector theme,
              set, wallet, and active intent evidence.
            </p>
          </div>
          <Link href="/market" className={cn(buttonVariants({ variant: "secondary" }))}>
            Market
          </Link>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<Boxes className="h-4 w-4" aria-hidden="true" />}
            label="Bundles"
            value={overview.health.totalBundles}
            detail={`${overview.health.detectedCards} cards`}
          />
          <KpiCard
            icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            label="High confidence"
            value={overview.health.highConfidenceBundles}
            detail={overview.health.mockData ? "mock-labeled" : "database"}
          />
          <KpiCard
            icon={<DollarSign className="h-4 w-4" aria-hidden="true" />}
            label="Total ask"
            value={formatMoney(overview.health.totalAskUsd)}
            detail={`${formatMoney(overview.health.totalFmvUsd)} FMV`}
          />
          <KpiCard
            icon={<Database className="h-4 w-4" aria-hidden="true" />}
            label="Source"
            value={overview.sourceMode}
            detail="deterministic"
          />
        </section>

        {overview.bundles.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium">No bundle candidates.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Atlas needs at least two compatible cards or active intent evidence to produce bundle candidates.
              </p>
            </CardContent>
          </Card>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {overview.bundles.map((bundle) => (
              <BundleCard key={bundle.id} bundle={bundle} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function KpiCard({
  icon,
  label,
  value,
  detail
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-muted-foreground">{label}</CardTitle>
          <div className="text-primary">{icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function BundleCard({ bundle }: { bundle: BundleView }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={bundle.confidence === "high" ? "default" : "secondary"}>
                {bundle.confidence}
              </Badge>
              <Badge variant="outline">{formatType(bundle.bundleType)}</Badge>
              <Badge variant={bundle.mockData ? "warning" : "secondary"}>{bundle.sourceLabel}</Badge>
            </div>
            <CardTitle className="mt-3 text-base">{bundle.name}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">{bundle.summary}</p>
          </div>
          <div className="text-right">
            <Layers3 className="ml-auto h-4 w-4 text-primary" aria-hidden="true" />
            <p className="mt-2 font-mono text-2xl font-semibold">{formatScore(bundle.score)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Cards" value={String(bundle.itemCount)} />
          <Metric label="Ask" value={formatMoney(bundle.totalAskUsd)} />
          <Metric label="FMV" value={formatMoney(bundle.totalFmvUsd)} />
        </div>
        <div className="mt-4 grid gap-2">
          {bundle.items.map((item) => (
            <Link
              key={`${bundle.id}:${item.tokenId}`}
              href={`/cards/${encodeURIComponent(item.tokenId)}`}
              className="rounded-md border bg-secondary/30 p-3 transition-colors hover:bg-secondary"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{item.card?.name ?? item.tokenId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.card == null
                      ? "Missing card evidence"
                      : `${item.card.setName} #${item.card.cardNumber}`}
                  </p>
                </div>
                <Badge variant="outline">{item.role.replaceAll("_", " ")}</Badge>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {bundle.reasons.map((reason) => (
            <Badge key={reason} variant="outline">
              {reason}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-secondary/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}
