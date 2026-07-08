import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Database,
  Lock,
  RefreshCw,
  ShieldCheck,
  Terminal
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminSyncOverview, type AdminSyncWarning } from "@/lib/admin-sync-data";
import { cn } from "@/lib/utils";

function formatDate(value: string | null) {
  if (value == null) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusVariant(status: string): "default" | "secondary" | "warning" | "destructive" | "outline" {
  if (status === "success" || status === "fresh") return "default";
  if (status === "failed" || status === "fail" || status === "error") return "destructive";
  if (status === "partial" || status === "locked" || status === "warn" || status === "stale") return "warning";
  if (status === "requested" || status === "started") return "secondary";
  return "outline";
}

export default async function AdminSyncPage() {
  const overview = await getAdminSyncOverview();

  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs text-primary uppercase">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold">Sync Control</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Source freshness, worker locks, and ingestion warnings for the Atlas read-only pipeline.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={overview.health.mockData ? "warning" : "secondary"}>
              {overview.sourceLabel}
            </Badge>
            <Link href="/market" className={cn(buttonVariants({ variant: "secondary" }))}>
              Market
            </Link>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Database className="h-4 w-4" aria-hidden="true" />}
            label="Cards"
            value={overview.health.totalCards}
            detail={`${overview.health.listedCards} listed`}
          />
          <MetricCard
            icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
            label="Freshness"
            value={overview.health.marketFreshness}
            detail={`${overview.health.staleCards} stale cards`}
          />
          <MetricCard
            icon={<Activity className="h-4 w-4" aria-hidden="true" />}
            label="Demand"
            value={overview.health.activeIntents}
            detail={`${overview.health.packPulls24h} pack pulls/24h`}
          />
          <MetricCard
            icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
            label="Warnings"
            value={overview.warnings.length}
            detail={`${overview.health.compMismatches} comp mismatches`}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Worker Jobs</CardTitle>
                <RefreshCw className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="border-b text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="py-2 pr-3 text-left font-medium">Job</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Latest run</th>
                      <th className="px-3 py-2 text-left font-medium">Records</th>
                      <th className="px-3 py-2 text-left font-medium">Lock</th>
                      <th className="py-2 pl-3 text-left font-medium">Command</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {overview.jobs.map((job) => (
                      <tr key={job.id}>
                        <td className="py-3 pr-3">
                          <p className="font-medium">{job.label}</p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">{job.cadence}</p>
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {formatDate(job.latestRunStartedAt)}
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-mono">{job.latestRunRecordsSeen}</span>
                          <span className="ml-2 text-muted-foreground">
                            {job.latestRunRecordsFailed} failed
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {job.locked ? (
                            <Badge variant="warning">
                              <Lock className="h-3 w-3" aria-hidden="true" />
                              {formatDate(job.lockExpiresAt)}
                            </Badge>
                          ) : (
                            <Badge variant="outline">open</Badge>
                          )}
                        </td>
                        <td className="py-3 pl-3">
                          <code className="rounded-md border bg-secondary px-2 py-1 font-mono text-xs">
                            {job.command}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Run Gate</CardTitle>
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-4">
                <p className="text-sm font-medium">Mode</p>
                <p className="mt-2 font-mono text-2xl font-semibold">{overview.mode}</p>
                <p className="mt-1 text-sm text-muted-foreground">{formatDate(overview.generatedAt)}</p>
              </div>
              <div className="rounded-md border p-4">
                <p className="text-sm font-medium">Manual endpoint</p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">POST /api/admin/sync/jobs</p>
              </div>
              <Link href="/api/health/ready" className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>
                <Terminal className="h-4 w-4" aria-hidden="true" />
                Readiness JSON
              </Link>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Data-Quality Warnings</CardTitle>
              <Badge variant={overview.warnings.length === 0 ? "default" : "warning"}>
                {overview.warnings.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {overview.warnings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No current data-quality warnings.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {overview.warnings.map((warning) => (
                  <WarningRow key={warning.id} warning={warning} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail
}: {
  icon: React.ReactNode;
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
        <p className="font-mono text-2xl font-semibold capitalize">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function WarningRow({ warning }: { warning: AdminSyncWarning }) {
  return (
    <article className="rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant={statusVariant(warning.severity)}>{warning.severity}</Badge>
          <h2 className="mt-3 text-sm font-medium">{warning.code}</h2>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{formatDate(warning.createdAt)}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{warning.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline">{warning.source ?? "unknown source"}</Badge>
        {warning.entity == null ? null : <Badge variant="outline">{warning.entity}</Badge>}
      </div>
    </article>
  );
}
