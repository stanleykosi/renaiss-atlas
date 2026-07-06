import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, Clock3, Database, DollarSign, PackageOpen, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPackMomentumOverview } from "@/lib/pack-data";
import type { PackMomentum, PackObservedIntervals, PackRecentPull } from "@/lib/pack-types";
import { cn } from "@/lib/utils";

function formatMoney(value: number | null | undefined) {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string | null) {
  if (value == null) return "Missing";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "N/A";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

function maxTierCount(distribution: Record<string, number>) {
  return Math.max(1, ...Object.values(distribution));
}

export default async function PacksPage() {
  const overview = await getPackMomentumOverview();

  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs text-primary uppercase">Packs</p>
            <h1 className="mt-2 text-3xl font-semibold">Pack Momentum</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Recent public Renaiss gacha pulls for RenaCrypt Pack and OMEGA, normalized from RSC source evidence.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={overview.health.mockData ? "warning" : "secondary"}>
              {overview.sourceMode === "seed" ? "Seed fixtures" : "Renaiss gacha RSC"}
            </Badge>
            <Link href="/market" className={cn(buttonVariants({ variant: "secondary" }))}>
              Market
            </Link>
          </div>
        </header>

        <section className="rounded-md border border-warning/40 bg-warning/10 p-4">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Observed intervals only</p>
              <p className="mt-1 text-sm text-muted-foreground">{overview.disclaimer}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<PackageOpen className="h-4 w-4" aria-hidden="true" />}
            label="Tracked packs"
            value={overview.health.totalPacks}
            detail={`${overview.health.totalPulls} stored pulls`}
          />
          <KpiCard
            icon={<Activity className="h-4 w-4" aria-hidden="true" />}
            label="Pulls 24h"
            value={overview.health.pulls24h}
            detail="observed public activity"
          />
          <KpiCard
            icon={<DollarSign className="h-4 w-4" aria-hidden="true" />}
            label="FMV 24h"
            value={formatMoney(overview.health.fmvPulled24h)}
            detail="from pull-time FMV"
          />
          <KpiCard
            icon={<Database className="h-4 w-4" aria-hidden="true" />}
            label="Latest pull"
            value={formatDate(overview.health.latestPulledAt)}
            detail={`${overview.health.stalePacks} stale packs`}
          />
        </section>

        {overview.packs.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium">No pack activity.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Atlas has not observed Renaiss gacha pulls for the tracked packs yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {overview.packs.map((pack) => (
              <PackCard key={pack.packSlug} pack={pack} />
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
        <p className="font-mono text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function PackCard({ pack }: { pack: PackMomentum }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={pack.freshness === "fresh" ? "default" : "warning"}>
                <Clock3 className="h-3 w-3" aria-hidden="true" />
                {pack.freshness}
              </Badge>
              <Badge variant={pack.mockData ? "warning" : "secondary"}>{pack.sourceLabel}</Badge>
            </div>
            <CardTitle className="mt-3 text-base">{pack.packName}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              {pack.pulls24h} pulls in the observed 24h window. Latest pull {formatDate(pack.latestPulledAt)}.
            </p>
          </div>
          <div className="text-right">
            <PackageOpen className="ml-auto h-4 w-4 text-primary" aria-hidden="true" />
            <p className="mt-2 font-mono text-2xl font-semibold">{pack.totalPulls}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="1h pulls" value={String(pack.pulls1h)} />
          <Metric label="24h FMV" value={formatMoney(pack.fmvPulled24h)} />
          <Metric label="Median interval" value={formatDuration(pack.observedIntervals.medianSeconds)} />
        </div>
        <TierDistribution distribution={pack.tierDistribution} />
        <IntervalSummary intervals={pack.observedIntervals} />
        <RecentPulls pulls={pack.recentPulls} />
      </CardContent>
    </Card>
  );
}

function TierDistribution({ distribution }: { distribution: Record<string, number> }) {
  const maxCount = maxTierCount(distribution);
  const entries = Object.entries(distribution);

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Tier Distribution</h2>
        <Badge variant="outline">{entries.length} tiers</Badge>
      </div>
      <div className="mt-3 grid gap-2">
        {entries.map(([tier, count]) => (
          <div key={tier} className="grid grid-cols-[88px_minmax(0,1fr)_44px] items-center gap-3 text-sm">
            <span className="truncate font-medium">{tier}</span>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(8, (count / maxCount) * 100)}%` }}
              />
            </div>
            <span className="text-right font-mono">{count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function IntervalSummary({ intervals }: { intervals: PackObservedIntervals }) {
  return (
    <section className="mt-5 rounded-md border bg-secondary/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Observed Intervals</h2>
        <Badge variant="outline">{intervals.samples} samples</Badge>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Min</dt>
          <dd className="mt-1 font-mono">{formatDuration(intervals.minSeconds)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Median</dt>
          <dd className="mt-1 font-mono">{formatDuration(intervals.medianSeconds)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Max</dt>
          <dd className="mt-1 font-mono">{formatDuration(intervals.maxSeconds)}</dd>
        </div>
      </dl>
    </section>
  );
}

function RecentPulls({ pulls }: { pulls: PackRecentPull[] }) {
  return (
    <section className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Recent Pulls</h2>
        <Badge variant="outline">{pulls.length}</Badge>
      </div>
      <div className="mt-3 grid gap-2">
        {pulls.map((pull) => (
          <article key={pull.activityId} className="rounded-md border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{pull.tier ?? "unknown"}</Badge>
                  {pull.psaId == null ? null : <Badge variant="outline">PSA {pull.psaId}</Badge>}
                  {pull.mockData ? <Badge variant="warning">mock data</Badge> : null}
                </div>
                <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                  {pull.activityId}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold">{formatMoney(pull.fmvUsd)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(pull.pulledAt)}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
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
