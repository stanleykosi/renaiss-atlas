"use client";

import Link from "next/link";
import * as React from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Clock3,
  Database,
  DollarSign,
  Eye,
  Filter,
  Info,
  Search,
  TrendingDown
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { applyMarketFilters, defaultMarketFilters, toggleSort } from "@/lib/market-filters";
import type {
  MarketCard,
  MarketFilters,
  MarketOverview,
  MarketScore,
  MarketSortKey
} from "@/lib/market-types";
import { cn } from "@/lib/utils";

type MarketWorkspaceProps = {
  initialData: MarketOverview;
};

const sortLabels: Record<MarketSortKey, string> = {
  name: "Card",
  askPriceUsd: "Ask",
  fmvUsd: "FMV",
  liquidityScore: "Liquidity",
  dealScore: "Deal",
  observedAt: "Observed"
};

function formatMoney(value: number | null) {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatScore(value: number | null) {
  if (value == null) return "N/A";
  return value.toFixed(0);
}

function scoreTypeLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatPct(value: number | null) {
  if (value == null) return "N/A";
  return `${value.toFixed(1)}%`;
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

function badgeVariant(card: MarketCard) {
  if (card.freshness === "stale") return "warning";
  if (card.riskFlags.includes("external_comp_mismatch")) return "destructive";
  return card.status === "listed" ? "default" : "secondary";
}

function kpiValue(value: string | number | null) {
  return value == null ? "N/A" : String(value);
}

export function MarketWorkspace({ initialData }: MarketWorkspaceProps) {
  const [filters, setFilters] = React.useState<MarketFilters>(defaultMarketFilters);
  const [selectedTokenId, setSelectedTokenId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  const visibleCards = React.useMemo(
    () => applyMarketFilters(initialData.cards, filters),
    [filters, initialData.cards]
  );
  const selectedCard =
    selectedTokenId == null
      ? null
      : initialData.cards.find((card) => card.tokenId === selectedTokenId) ?? null;

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  function openCard(card: MarketCard) {
    setSelectedTokenId(card.tokenId);
    setDrawerOpen(true);
  }

  function updateFilter<Key extends keyof MarketFilters>(key: Key, value: MarketFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Database className="h-4 w-4" aria-hidden="true" />}
          label="Cards"
          value={initialData.health.totalCards}
          detail={`${initialData.health.listedCards} listed`}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" aria-hidden="true" />}
          label="Listed ask"
          value={formatMoney(initialData.health.totalAskUsd)}
          detail={`${formatMoney(initialData.health.totalFmvUsd)} FMV`}
        />
        <KpiCard
          icon={<TrendingDown className="h-4 w-4" aria-hidden="true" />}
          label="Under FMV"
          value={initialData.health.underFmvCount}
          detail={`${initialData.health.externalMismatchCount} comp mismatches`}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          label="Liquidity"
          value={kpiValue(
            initialData.health.averageLiquidityScore == null
              ? null
              : initialData.health.averageLiquidityScore.toFixed(0)
          )}
          detail={`${initialData.health.staleCards} stale`}
        />
      </section>

      <section className="rounded-md border bg-card px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={initialData.health.freshness === "fresh" ? "default" : "warning"}>
              <Clock3 className="h-3 w-3" aria-hidden="true" />
              {initialData.health.freshness}
            </Badge>
            <Badge variant={initialData.health.mockData ? "warning" : "secondary"}>
              {initialData.health.sourceLabel}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatDate(initialData.health.lastObservedAt)}
            </span>
          </div>
          <span className="font-mono text-xs text-muted-foreground uppercase">
            {initialData.sourceMode}
          </span>
        </div>
      </section>

      <Card>
        <CardHeader className="gap-4 pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" aria-hidden="true" />
              <CardTitle>Market Cards</CardTitle>
              <Badge variant="outline">{visibleCards.length}</Badge>
            </div>
            <Button
              variant="secondary"
              disabled={!hydrated}
              onClick={() => setFilters(defaultMarketFilters)}
            >
              Reset
            </Button>
          </div>

          <fieldset
            className="m-0 grid gap-3 border-0 p-0 disabled:opacity-70 md:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]"
            data-market-filters-hydrated={hydrated ? "true" : "false"}
            disabled={!hydrated}
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label="Search cards"
                className="pl-9"
                placeholder="Search cards"
                value={filters.q}
                onChange={(event) => updateFilter("q", event.target.value)}
              />
            </div>
            <Select
              aria-label="Status"
              value={filters.status}
              onChange={(event) =>
                updateFilter("status", event.target.value as MarketFilters["status"])
              }
            >
              <option value="all">All status</option>
              {initialData.filters.statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Language"
              value={filters.language}
              onChange={(event) => updateFilter("language", event.target.value)}
            >
              <option value="all">All languages</option>
              {initialData.filters.languages.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Grader"
              value={filters.grader}
              onChange={(event) => updateFilter("grader", event.target.value)}
            >
              <option value="all">All graders</option>
              {initialData.filters.graders.map((grader) => (
                <option key={grader} value={grader}>
                  {grader}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Grade"
              value={filters.grade}
              onChange={(event) => updateFilter("grade", event.target.value)}
            >
              <option value="all">All grades</option>
              {initialData.filters.grades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </Select>
          </fieldset>
        </CardHeader>

        <CardContent>
          <Table aria-label="Market cards">
            <TableHeader>
              <TableRow>
                <SortableHead sortKey="name" filters={filters} setFilters={setFilters} />
                <TableHead>Status</TableHead>
                <SortableHead sortKey="askPriceUsd" filters={filters} setFilters={setFilters} />
                <SortableHead sortKey="fmvUsd" filters={filters} setFilters={setFilters} />
                <SortableHead sortKey="liquidityScore" filters={filters} setFilters={setFilters} />
                <SortableHead sortKey="dealScore" filters={filters} setFilters={setFilters} />
                <SortableHead sortKey="observedAt" filters={filters} setFilters={setFilters} />
                <TableHead className="w-12 text-right">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleCards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                    No matching cards.
                  </TableCell>
                </TableRow>
              ) : (
                visibleCards.map((card) => (
                  <TableRow
                    key={card.tokenId}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() => openCard(card)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openCard(card);
                      }
                    }}
                  >
                    <TableCell>
                      <div className="flex min-w-[220px] items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-secondary font-mono text-xs text-primary">
                          {card.grade ?? "NA"}
                        </div>
                        <div>
                          <p className="font-medium">{card.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {card.setName} #{card.cardNumber}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant(card)}>{card.status}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{formatMoney(card.askPriceUsd)}</TableCell>
                    <TableCell className="font-mono">{formatMoney(card.fmvUsd)}</TableCell>
                    <TableCell>
                      <ScoreCell
                        label="Liquidity"
                        score={card.scores.liquidity}
                        value={card.liquidityScore}
                      />
                    </TableCell>
                    <TableCell>
                      <ScoreCell label="Deal" score={card.scores.deal} value={card.dealScore} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(card.observedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        aria-label={`Open ${card.name}`}
                        variant="ghost"
                        className="h-8 w-8 px-0"
                        onClick={(event) => {
                          event.stopPropagation();
                          openCard(card);
                        }}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent>
          {selectedCard == null ? null : <CardDrawer card={selectedCard} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function KpiCard({
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
        <p className="font-mono text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ScoreCell({
  label,
  score,
  value
}: {
  label: string;
  score: MarketScore | undefined;
  value: number | null;
}) {
  const displayValue = score?.value ?? value;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={`${label} score details`}
          variant="ghost"
          className="h-8 min-w-16 justify-start px-2 font-mono"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {formatScore(displayValue)}
          <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{formatScore(displayValue)}</p>
          </div>
          <Badge variant={score?.confidence === "high" ? "default" : "secondary"}>
            {score?.confidence ?? "low"}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline">{score?.source ?? "deterministic"}</Badge>
          <Badge variant="outline">{score == null ? label.toLowerCase() : scoreTypeLabel(score.scoreType)}</Badge>
        </div>
        <div className="mt-4 space-y-2">
          {(score?.reasons.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No score reasons available.</p>
          ) : (
            score?.reasons.map((reason) => (
              <p key={reason} className="text-sm text-muted-foreground">
                {reason}
              </p>
            ))
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(score?.riskFlags.length ?? 0) === 0 ? (
            <Badge variant="outline">no flags</Badge>
          ) : (
            score?.riskFlags.map((flag) => (
              <Badge key={flag} variant={flag === "mock_data" ? "warning" : "destructive"}>
                {flag.replaceAll("_", " ")}
              </Badge>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SortableHead({
  sortKey,
  filters,
  setFilters
}: {
  sortKey: MarketSortKey;
  filters: MarketFilters;
  setFilters: React.Dispatch<React.SetStateAction<MarketFilters>>;
}) {
  return (
    <TableHead>
      <Button
        variant="ghost"
        className="h-8 px-2 text-xs uppercase"
        onClick={() => setFilters((current) => toggleSort(current, sortKey))}
      >
        {sortLabels[sortKey]}
        <ArrowUpDown
          className={`h-3.5 w-3.5 ${filters.sortBy === sortKey ? "text-primary" : ""}`}
          aria-hidden="true"
        />
      </Button>
    </TableHead>
  );
}

function CardDrawer({ card }: { card: MarketCard }) {
  const scoreRows: [string, MarketScore | undefined][] = [
    ["Liquidity", card.scores.liquidity],
    ["Deal", card.scores.deal],
    ["Price confidence", card.scores.price_confidence],
    ["External comp confidence", card.scores.external_comp_confidence],
    ["Activity velocity", card.scores.activity_velocity],
    ["Offer depth", card.scores.offer_depth],
    ["Price consensus", card.scores.price_consensus],
    ["Listing health", card.scores.listing_health],
    ["Demand", card.scores.demand],
    ["Collector premium", card.scores.collector_premium],
    ["Collateral readiness", card.scores.collateral_readiness]
  ];

  return (
    <>
      <SheetHeader>
        <SheetTitle>{card.name}</SheetTitle>
        <SheetDescription>
          {card.setName} #{card.cardNumber} - {card.grader ?? "Ungraded"} {card.grade ?? ""}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-5">
        <Link
          href={`/cards/${encodeURIComponent(card.tokenId)}`}
          className={cn(buttonVariants({ variant: "secondary", className: "mb-5 w-fit" }))}
        >
          Open card page
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Ask" value={formatMoney(card.askPriceUsd)} />
          <Metric label="FMV" value={formatMoney(card.fmvUsd)} />
          <Metric label="Deal delta" value={formatPct(card.dealDeltaPct)} />
          <Metric label="Liquidity" value={formatScore(card.liquidityScore)} />
        </div>

        <section className="mt-5 rounded-md border p-4">
          <h3 className="text-sm font-medium">Signals</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={card.confidence === "high" ? "default" : "secondary"}>
              {card.confidence} confidence
            </Badge>
            <Badge variant={card.freshness === "fresh" ? "default" : "warning"}>
              {card.freshness}
            </Badge>
            <Badge variant={card.mockData ? "warning" : "secondary"}>{card.sourceLabel}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {card.riskFlags.length === 0 ? (
              <Badge variant="outline">no flags</Badge>
            ) : (
              card.riskFlags.map((flag) => (
                <Badge key={flag} variant={flag === "mock_data" ? "warning" : "destructive"}>
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  {flag.replaceAll("_", " ")}
                </Badge>
              ))
            )}
          </div>
        </section>

        <section className="mt-5 rounded-md border p-4">
          <h3 className="text-sm font-medium">Scores</h3>
          <div className="mt-3 grid gap-3">
            {scoreRows.map(([label, score]) => (
              <div key={label} className="rounded-md border bg-secondary/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="mt-1 font-mono text-lg font-semibold">
                      {formatScore(score?.value ?? null)}
                    </p>
                  </div>
                  <Badge variant={score?.confidence === "high" ? "default" : "secondary"}>
                    {score?.confidence ?? "low"}
                  </Badge>
                </div>
                {(score?.reasons.length ?? 0) === 0 ? null : (
                  <p className="mt-2 text-xs text-muted-foreground">{score?.reasons[0]}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-md border p-4">
          <h3 className="text-sm font-medium">Card</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Detail label="TCG" value={card.tcg} />
            <Detail label="Language" value={card.language ?? "N/A"} />
            <Detail label="Year" value={card.year == null ? "N/A" : String(card.year)} />
            <Detail label="Serial" value={card.serial ?? "N/A"} />
            <Detail label="Owner" value={card.ownerUsername ?? "N/A"} />
            <Detail label="Observed" value={formatDate(card.observedAt)} />
          </dl>
        </section>

        <section className="mt-5 rounded-md border p-4">
          <h3 className="text-sm font-medium">External Comps</h3>
          <div className="mt-3 grid gap-3">
            {card.externalComps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No external comps.</p>
            ) : (
              card.externalComps.map((comp) => (
                <div key={comp.id} className="rounded-md border bg-secondary/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{comp.productTitle ?? comp.platform}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {formatMoney(comp.currentPriceUsd)} - {comp.matchConfidence.toFixed(0)}
                      </p>
                    </div>
                    <Badge variant={comp.rejected ? "destructive" : "default"}>
                      {comp.rejected ? "rejected" : "accepted"}
                    </Badge>
                  </div>
                  {comp.rejectionReason == null ? null : (
                    <p className="mt-2 text-xs text-muted-foreground">{comp.rejectionReason}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}
