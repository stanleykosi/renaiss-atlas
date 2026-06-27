import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  HandCoins,
  ListChecks,
  Share2,
  ShieldCheck,
  Sparkles,
  WalletCards
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getWalletCopilot } from "@/lib/wallet-data";
import type { WalletCopilotView, WalletHolding, WalletSummary } from "@/lib/wallet-types";
import { cn } from "@/lib/utils";

type WalletPageProps = {
  params: Promise<{ address: string }>;
};

function formatMoney(value: number | null | undefined) {
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

function formatPercent(value: number | null | undefined) {
  if (value == null) return "N/A";
  return `${(value * 100).toFixed(0)}%`;
}

function compactAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatDate(value: string | null | undefined) {
  if (value == null) return "Missing";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatType(value: string) {
  return value.replaceAll("_", " ");
}

function riskVariant(flag: string) {
  if (flag === "mock_data") return "warning";
  if (flag.includes("mismatch") || flag.includes("stale")) return "destructive";
  return "outline";
}

export default async function WalletPage({ params }: WalletPageProps) {
  const { address } = await params;
  const result = await getWalletCopilot(address);

  if (result.status === "invalid") {
    return <WalletMessage title="Invalid wallet address" detail={result.message} />;
  }

  if (result.status === "empty") {
    return (
      <WalletMessage
        title="No indexed holdings"
        detail={`Atlas has no seeded or database-backed Renaiss holdings for ${compactAddress(result.address)}.`}
        summary={result.summary}
      />
    );
  }

  return <WalletDashboard data={result.data} />;
}

function WalletDashboard({ data }: { data: WalletCopilotView }) {
  const latestFreshness = data.freshness[0] ?? null;

  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-5 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/market"
              className={cn(buttonVariants({ variant: "ghost", className: "-ml-2 h-8 px-2" }))}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Market
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant={data.summary.mockData ? "warning" : "secondary"}>{data.summary.sourceLabel}</Badge>
              <Badge variant={latestFreshness?.status === "fresh" ? "default" : "warning"}>
                <Clock3 className="h-3 w-3" aria-hidden="true" />
                {latestFreshness?.status ?? "missing"}
              </Badge>
              <Badge variant="outline">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Read only
              </Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">Wallet Copilot</h1>
            <p className="mt-2 break-all font-mono text-sm text-muted-foreground">{data.address}</p>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Public holdings analysis only. Atlas never asks for wallet signatures, approvals, private keys,
              seed phrases, custody, or trade execution.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[560px]">
            <HeaderMetric label="Cards" value={String(data.summary.totalCards)} />
            <HeaderMetric label="FMV" value={formatMoney(data.summary.estimatedFmvUsd)} />
            <HeaderMetric label="Avg liquidity" value={formatScore(data.summary.averageLiquidityScore)} />
            <HeaderMetric label="Bundles" value={String(data.summary.bundleOpportunityCount)} />
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<WalletCards className="h-4 w-4" aria-hidden="true" />}
            label="Holdings"
            value={`${data.summary.totalCards}`}
            detail={`${data.summary.listedCards} listed / ${data.summary.unlistedCards} unlisted`}
          />
          <KpiCard
            icon={<HandCoins className="h-4 w-4" aria-hidden="true" />}
            label="Listed ask"
            value={formatMoney(data.summary.listedAskUsd)}
            detail={`${formatMoney(data.summary.estimatedFmvUsd)} estimated FMV`}
          />
          <KpiCard
            icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            label="Comp coverage"
            value={formatPercent(data.summary.highConfidenceCompRatio)}
            detail={`${formatPercent(data.summary.staleDataRatio)} stale data`}
          />
          <KpiCard
            icon={<Database className="h-4 w-4" aria-hidden="true" />}
            label="Source"
            value={data.summary.sourceMode}
            detail={formatDate(latestFreshness?.observedAt)}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="flex flex-col gap-6">
            <ActionPlan data={data} />
            <HoldingsTable holdings={data.holdings} />
          </div>

          <aside className="flex flex-col gap-6">
            <BundleOpportunities data={data} />
            <IntentPlaceholder summary={data.summary} />
            <ShareSummaryCard summary={data.summary} />
          </aside>
        </section>
      </div>
    </main>
  );
}

function WalletMessage({
  title,
  detail,
  summary
}: {
  title: string;
  detail: string;
  summary?: WalletSummary;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="w-full max-w-xl rounded-md border bg-card p-6">
        <WalletCards className="h-5 w-5 text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        {summary != null ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Metric label="Cards" value={String(summary.totalCards)} />
            <Metric label="Source" value={summary.sourceLabel} />
          </div>
        ) : null}
        <p className="mt-5 text-xs text-muted-foreground">
          Wallet pages are read-only and do not request signatures or token approvals.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/wallet/0x1111111111111111111111111111111111111111" className={cn(buttonVariants())}>
            Open demo wallet
          </Link>
          <Link href="/market" className={cn(buttonVariants({ variant: "secondary" }))}>
            Market
          </Link>
        </div>
      </section>
    </main>
  );
}

function ActionPlan({ data }: { data: WalletCopilotView }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />
            <CardTitle>Ranked Action Plan</CardTitle>
          </div>
          <Badge variant="outline">{data.actions.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {data.actions.map((action) => (
            <article key={`${action.priority}:${action.title}`} className="rounded-md border bg-secondary/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-card font-mono text-xs">
                    {action.priority}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{action.actionType.replaceAll("_", " ")}</Badge>
                      <Badge variant={action.confidence === "high" ? "default" : "secondary"}>
                        {action.confidence}
                      </Badge>
                    </div>
                    <h2 className="mt-2 text-sm font-medium">{action.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{action.reason}</p>
                  </div>
                </div>
                {action.cta == null ? null : (
                  <Link href={action.cta.href} className={cn(buttonVariants({ variant: "ghost", className: "h-8 px-2" }))}>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    {action.cta.label}
                  </Link>
                )}
              </div>
              <RiskFlags flags={action.risks} />
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HoldingsTable({ holdings }: { holdings: WalletHolding[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <WalletCards className="h-4 w-4 text-primary" aria-hidden="true" />
            <CardTitle>Holdings</CardTitle>
          </div>
          <Badge variant="outline">{holdings.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Card</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ask</TableHead>
              <TableHead>FMV</TableHead>
              <TableHead>Liquidity</TableHead>
              <TableHead>Priority</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding) => (
              <TableRow key={holding.tokenId}>
                <TableCell>
                  <Link
                    href={`/cards/${encodeURIComponent(holding.tokenId)}`}
                    className="font-medium hover:text-primary"
                  >
                    {holding.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {holding.setName} #{holding.cardNumber} - {holding.grader ?? "Ungraded"} {holding.grade ?? ""}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant={holding.status === "listed" ? "default" : "secondary"}>
                    {holding.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono">{formatMoney(holding.askPriceUsd)}</TableCell>
                <TableCell className="font-mono">{formatMoney(holding.fmvUsd)}</TableCell>
                <TableCell className="font-mono">{formatScore(holding.liquidityScore)}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono">{formatScore(holding.actionPriority)}</span>
                    <Badge variant="outline">{holding.actionLabel}</Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BundleOpportunities({ data }: { data: WalletCopilotView }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary" aria-hidden="true" />
            <CardTitle>Bundle Opportunities</CardTitle>
          </div>
          <Badge variant="outline">{data.bundles.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {data.bundles.length === 0 ? (
          <EmptyState title="No bundle candidates" detail="This wallet does not currently intersect deterministic bundle candidates." />
        ) : (
          <div className="grid gap-3">
            {data.bundles.slice(0, 5).map((bundle) => (
              <article key={bundle.id} className="rounded-md border bg-secondary/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={bundle.confidence === "high" ? "default" : "secondary"}>
                        {bundle.confidence}
                      </Badge>
                      <Badge variant="outline">{formatType(bundle.bundleType)}</Badge>
                    </div>
                    <h2 className="mt-2 text-sm font-medium">{bundle.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{bundle.summary}</p>
                  </div>
                  <p className="font-mono text-lg font-semibold">{formatScore(bundle.score)}</p>
                </div>
                <div className="mt-3 grid gap-2">
                  {bundle.items.slice(0, 3).map((item) => (
                    <Link
                      key={`${bundle.id}:${item.tokenId}`}
                      href={`/cards/${encodeURIComponent(item.tokenId)}`}
                      className="rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-secondary"
                    >
                      {item.card?.name ?? item.tokenId}
                    </Link>
                  ))}
                </div>
              </article>
            ))}
            <Link href="/bundles" className={cn(buttonVariants({ variant: "secondary", className: "w-fit" }))}>
              Open bundle explorer
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntentPlaceholder({ summary }: { summary: WalletSummary }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            <CardTitle>Intent Matches</CardTitle>
          </div>
          <Badge variant="outline">{summary.intentMatchCount}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <EmptyState
          title="Intent detail coming next"
          detail="Wallet-level intent matching is represented in deterministic demand signals for now. The full intent match list will attach active buyer-intent rows here."
        />
      </CardContent>
    </Card>
  );
}

function ShareSummaryCard({ summary }: { summary: WalletSummary }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" aria-hidden="true" />
          <CardTitle>Share Summary Card</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border bg-secondary/30 p-4">
          <p className="font-mono text-xs text-muted-foreground">{compactAddress(summary.address)}</p>
          <h2 className="mt-2 text-lg font-semibold">Renaiss Atlas Wallet Snapshot</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {summary.totalCards} cards, {formatMoney(summary.estimatedFmvUsd)} estimated FMV,
            {` ${summary.bundleOpportunityCount}`} bundle opportunities, and
            {` ${summary.intentMatchCount}`} demand signals.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant={summary.mockData ? "warning" : "secondary"}>{summary.sourceLabel}</Badge>
            <Badge variant="outline">read only</Badge>
            <Badge variant="outline">no signatures</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
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
  value: string;
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

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-lg font-semibold">{value}</p>
    </div>
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

function RiskFlags({ flags }: { flags: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {flags.length === 0 ? (
        <Badge variant="outline">no flags</Badge>
      ) : (
        flags.map((flag) => (
          <Badge key={flag} variant={riskVariant(flag)}>
            {flag === "mock_data" ? null : <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
            {flag.replaceAll("_", " ")}
          </Badge>
        ))
      )}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-dashed bg-secondary/20 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
