import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { AiCardMemoResult } from "@renaiss/ai";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Clock3,
  Database,
  FileSearch,
  Gauge,
  HandCoins,
  ListChecks,
  Sparkles,
  Tag
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCardMemoForDetail } from "@/lib/ai-memo-data";
import { getBundlesForCard } from "@/lib/bundle-data";
import type { BundleView } from "@/lib/bundle-types";
import { getIntentMatchesForCard } from "@/lib/intent-data";
import type { IntentMatchView } from "@/lib/intent-types";
import { getCardDetail } from "@/lib/market-data";
import type { MarketCard, MarketScore } from "@/lib/market-types";
import { cn } from "@/lib/utils";

type CardDetailPageProps = {
  params: Promise<{ tokenId: string }>;
};

type Recommendation = {
  title: string;
  detail: string;
  confidence: MarketCard["confidence"];
  riskFlags: string[];
};

type TimelineItem = {
  title: string;
  detail: string;
  observedAt: string | null;
  badge: string;
};

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

function compactId(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatType(value: string) {
  return value.replaceAll("_", " ");
}

function badgeVariant(card: MarketCard) {
  if (card.riskFlags.includes("external_comp_mismatch")) return "destructive";
  if (card.freshness === "stale") return "warning";
  return card.status === "listed" ? "default" : "secondary";
}

function buildRecommendations(card: MarketCard): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const collectorPremium = card.scores.collector_premium?.value ?? 0;
  const demand = card.scores.demand?.value ?? 0;

  if (card.riskFlags.includes("external_comp_mismatch")) {
    recommendations.push({
      title: "Verify comp mismatch",
      detail: "Resolve rejected external evidence before relying on price or deal signals.",
      confidence: "medium",
      riskFlags: ["external_comp_mismatch"]
    });
  }

  if (card.dealDeltaPct != null && card.dealDeltaPct > 10 && (card.dealScore ?? 0) >= 35) {
    recommendations.push({
      title: "Review discounted ask",
      detail: "Ask is below FMV with deterministic deal support. Treat as an evidence review, not an execution prompt.",
      confidence: card.confidence,
      riskFlags: card.riskFlags.filter((flag) => flag !== "mock_data")
    });
  }

  if (collectorPremium >= 25) {
    recommendations.push({
      title: "Package collector story",
      detail: "Collector-premium signals suggest this card may benefit from bundle or provenance context.",
      confidence: card.scores.collector_premium?.confidence ?? "medium",
      riskFlags: card.scores.collector_premium?.riskFlags ?? []
    });
  }

  if (card.status === "unlisted" && demand >= 25) {
    recommendations.push({
      title: "Watch demand match",
      detail: "Demand evidence exists while the card is unlisted. Monitor intent fit before changing listing posture.",
      confidence: card.scores.demand?.confidence ?? "medium",
      riskFlags: card.scores.demand?.riskFlags ?? []
    });
  }

  if (card.freshness === "stale") {
    recommendations.push({
      title: "Refresh source data",
      detail: "Marketplace evidence is stale, so downstream score confidence should be treated cautiously.",
      confidence: "low",
      riskFlags: ["stale_renaiss_data"]
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "Monitor price confidence",
      detail: "No urgent deterministic action candidate is present. Continue tracking score and freshness movement.",
      confidence: card.confidence,
      riskFlags: card.riskFlags.filter((flag) => flag !== "mock_data")
    });
  }

  return recommendations;
}

function buildTimeline(card: MarketCard): TimelineItem[] {
  const sourceItems = card.sourceIds.map((sourceId) => ({
    title: "Source record",
    detail: compactId(sourceId),
    observedAt: card.observedAt,
    badge: card.sourceLabel
  }));
  const compItems = card.externalComps.map((comp) => ({
    title: comp.rejected ? "Rejected external comp" : "External comp",
    detail: comp.productTitle ?? comp.platform,
    observedAt: comp.fetchedAt,
    badge: comp.platform
  }));
  const scoreItems = Object.values(card.scores).map((score) => ({
    title: score.scoreType.replaceAll("_", " "),
    detail: `${formatScore(score.value)} ${score.confidence}`,
    observedAt: score.computedAt,
    badge: score.source
  }));

  return [...sourceItems, ...compItems, ...scoreItems].sort((left, right) => {
    const leftTime = left.observedAt == null ? 0 : Date.parse(left.observedAt);
    const rightTime = right.observedAt == null ? 0 : Date.parse(right.observedAt);
    return rightTime - leftTime;
  });
}

function getScoreRows(card: MarketCard): [string, MarketScore | undefined][] {
  return [
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
}

export default async function CardDetailPage({ params }: CardDetailPageProps) {
  const { tokenId } = await params;
  const decodedTokenId = decodeURIComponent(tokenId);
  const detail = await getCardDetail(decodedTokenId);

  if (detail == null) {
    notFound();
  }

  const [cardBundles, cardIntentMatches, cardMemo] = await Promise.all([
    getBundlesForCard(decodedTokenId),
    getIntentMatchesForCard(decodedTokenId),
    getCardMemoForDetail(detail)
  ]);

  const card = detail.item;
  const recommendations = buildRecommendations(card);
  const timeline = buildTimeline(card);
  const scoreRows = getScoreRows(card);

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
              <Badge variant={badgeVariant(card)}>{card.status}</Badge>
              <Badge variant={card.freshness === "fresh" ? "default" : "warning"}>
                <Clock3 className="h-3 w-3" aria-hidden="true" />
                {card.freshness}
              </Badge>
              <Badge variant={card.mockData ? "warning" : "secondary"}>{card.sourceLabel}</Badge>
              <Badge variant={cardIntentMatches.length > 0 ? "default" : "outline"}>
                <HandCoins className="h-3 w-3" aria-hidden="true" />
                Seller demand: {cardIntentMatches.length}
              </Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">{card.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {card.setName} #{card.cardNumber} - {card.grader ?? "Ungraded"} {card.grade ?? ""}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[520px]">
            <HeaderMetric label="Liquidity" value={formatScore(card.liquidityScore)} />
            <HeaderMetric label="Deal" value={formatScore(card.dealScore)} />
            <HeaderMetric label="Ask" value={formatMoney(card.askPriceUsd)} />
            <HeaderMetric label="FMV" value={formatMoney(card.fmvUsd)} />
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" aria-hidden="true" />
                  <CardTitle>Price</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="Ask" value={formatMoney(card.askPriceUsd)} />
                  <Metric label="FMV" value={formatMoney(card.fmvUsd)} />
                  <Metric label="Top offer" value={formatMoney(card.topOfferUsd)} />
                  <Metric label="Deal delta" value={formatPct(card.dealDeltaPct)} />
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <Detail label="Last sale" value={formatMoney(card.lastSaleUsd)} />
                  <Detail label="Buyback base" value={formatMoney(card.buybackBaseValueUsd)} />
                  <Detail label="Observed" value={formatDate(card.observedAt)} />
                  <Detail label="Token" value={card.tokenId} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" aria-hidden="true" />
                  <CardTitle>Scores</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {scoreRows.map(([label, score]) => (
                    <ScoreRow key={label} label={label} score={score} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />
                  <CardTitle>Recommended Actions</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {recommendations.map((recommendation) => (
                    <ActionRow key={recommendation.title} recommendation={recommendation} />
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Informational only. Atlas never requests keys, approvals, custody, or trade execution.
                </p>
              </CardContent>
            </Card>
          </div>

          <aside className="flex flex-col gap-6">
            <AiMemoPanel memo={cardMemo} />

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" aria-hidden="true" />
                  <CardTitle>Source Timeline</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <EmptyState title="No source events" detail="No source IDs or computed scores are attached." />
                ) : (
                  <ol className="space-y-3">
                    {timeline.slice(0, 8).map((item) => (
                      <li key={`${item.title}:${item.detail}:${item.observedAt}`} className="rounded-md border bg-secondary/30 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium capitalize">{item.title}</p>
                            <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
                              {item.detail}
                            </p>
                          </div>
                          <Badge variant="outline">{item.badge}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.observedAt)}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            <PlaceholderSection
              icon={<FileSearch className="h-4 w-4 text-primary" aria-hidden="true" />}
              title="External Comps"
              badge={`${card.externalComps.length} records`}
              detail={
                card.externalComps.length === 0
                  ? "No external comp evidence recorded for this card."
                  : "Comp review is pending. Current records are preserved in source evidence."
              }
            />
            <BundlePanel bundles={cardBundles} tokenId={card.tokenId} />
            <IntentMatchPanel matches={cardIntentMatches} demandScore={card.scores.demand?.value} />
          </aside>
        </section>
      </div>
    </main>
  );
}

function AiMemoPanel({ memo }: { memo: AiCardMemoResult | null }) {
  if (memo == null) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            <CardTitle>AI Memo</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <EmptyState title="No memo available" detail="No source-cited memo could be generated for this card." />
        </CardContent>
      </Card>
    );
  }

  const output = memo.output;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            <CardTitle>AI Memo</CardTitle>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant={output.confidence === "high" ? "default" : "secondary"}>
              {output.confidence}
            </Badge>
            <Badge variant={memo.deterministicFallback ? "warning" : "outline"}>
              {memo.deterministicFallback ? "deterministic fallback" : memo.provider}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border bg-secondary/30 p-3">
          <p className="text-sm font-medium">{output.nextAction.label}</p>
          <p className="mt-2 text-sm text-muted-foreground">{output.recommendation}</p>
        </div>

        <section className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Evidence</h3>
          <ul className="mt-2 grid gap-2">
            {output.evidence.map((item) => (
              <li key={item} className="rounded-md border bg-card px-3 py-2 text-sm">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Risks</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {output.risks.map((risk) => (
              <Badge key={risk} variant={risk.toLowerCase().includes("mock") ? "warning" : "outline"}>
                {risk}
              </Badge>
            ))}
          </div>
        </section>

        <section className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Sources</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {output.sourcesUsed.map((sourceId) => (
              <Badge key={sourceId} variant="secondary" className="font-mono">
                {compactId(sourceId)}
              </Badge>
            ))}
          </div>
        </section>

        <p className="mt-4 rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
          {output.disclaimer}
        </p>
      </CardContent>
    </Card>
  );
}

function BundlePanel({ bundles, tokenId }: { bundles: BundleView[]; tokenId: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary" aria-hidden="true" />
            <CardTitle>Bundles</CardTitle>
          </div>
          <Badge variant="outline">{bundles.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {bundles.length === 0 ? (
          <EmptyState
            title="No bundle candidates"
            detail="No deterministic bundle currently includes this card."
          />
        ) : (
          <div className="grid gap-3">
            {bundles.map((bundle) => (
              <article key={bundle.id} className="rounded-md border bg-secondary/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={bundle.confidence === "high" ? "default" : "secondary"}>
                        {bundle.confidence}
                      </Badge>
                      <Badge variant="outline">{formatType(bundle.bundleType)}</Badge>
                    </div>
                    <h3 className="mt-2 text-sm font-medium">{bundle.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{bundle.summary}</p>
                  </div>
                  <p className="font-mono text-lg font-semibold">{formatScore(bundle.score)}</p>
                </div>
                <div className="mt-3 grid gap-2">
                  {bundle.items
                    .filter((item) => item.tokenId !== tokenId)
                    .slice(0, 3)
                    .map((item) => (
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

function IntentMatchPanel({
  matches,
  demandScore
}: {
  matches: IntentMatchView[];
  demandScore: number | null | undefined;
}) {
  const sortedMatches = [...matches].sort((left, right) => right.matchScore - left.matchScore);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-primary" aria-hidden="true" />
            <CardTitle>Intents</CardTitle>
          </div>
          <Badge variant={matches.length > 0 ? "default" : "outline"}>
            {matches.length} demand
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {sortedMatches.length === 0 ? (
          <EmptyState
            title="No active demand matches"
            detail="No deterministic intent currently matches this card."
          />
        ) : (
          <div className="grid gap-3">
            <div className="rounded-md border bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">Demand score</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{formatScore(demandScore)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Intent signals are informational only and never execute listings, approvals, escrow, or trades.
              </p>
            </div>
            {sortedMatches.map((match) => (
              <article key={`${match.intentId}:${match.tokenId}`} className="rounded-md border bg-secondary/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={match.confidence === "high" ? "default" : "secondary"}>
                        {match.confidence}
                      </Badge>
                      <Badge variant="outline">{formatType(match.intentType)}</Badge>
                    </div>
                    <h3 className="mt-2 text-sm font-medium">{match.queryText}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {match.creatorAlias ?? "anonymous"} - {formatDate(match.createdAt)}
                    </p>
                  </div>
                  <p className="font-mono text-lg font-semibold">{formatScore(match.matchScore)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {match.reasons.map((reason) => (
                    <Badge key={reason} variant="outline">
                      {reason}
                    </Badge>
                  ))}
                </div>
                {match.riskFlags.length === 0 ? null : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {match.riskFlags.map((flag) => (
                      <Badge key={flag} variant={flag === "mock_data" ? "warning" : "destructive"}>
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        {flag.replaceAll("_", " ")}
                      </Badge>
                    ))}
                  </div>
                )}
              </article>
            ))}
            <Link href="/intents" className={cn(buttonVariants({ variant: "secondary", className: "w-fit" }))}>
              Open intent board
            </Link>
          </div>
        )}
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
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-mono">{value}</dd>
    </div>
  );
}

function ScoreRow({ label, score }: { label: string; score: MarketScore | undefined }) {
  return (
    <div className="rounded-md border bg-secondary/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 font-mono text-xl font-semibold">{formatScore(score?.value)}</p>
        </div>
        <Badge variant={score?.confidence === "high" ? "default" : "secondary"}>
          {score?.confidence ?? "low"}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {score?.reasons[0] ?? "No score reason available."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(score?.riskFlags.length ?? 0) === 0 ? (
          <Badge variant="outline">no flags</Badge>
        ) : (
          score?.riskFlags.map((flag) => (
            <Badge key={flag} variant={flag === "mock_data" ? "warning" : "destructive"}>
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {flag.replaceAll("_", " ")}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}

function ActionRow({ recommendation }: { recommendation: Recommendation }) {
  return (
    <article className="rounded-md border bg-secondary/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-medium">{recommendation.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{recommendation.detail}</p>
          </div>
        </div>
        <Badge variant={recommendation.confidence === "high" ? "default" : "secondary"}>
          {recommendation.confidence}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {recommendation.riskFlags.length === 0 ? (
          <Badge variant="outline">no flags</Badge>
        ) : (
          recommendation.riskFlags.map((flag) => (
            <Badge key={flag} variant="warning">
              {flag.replaceAll("_", " ")}
            </Badge>
          ))
        )}
      </div>
    </article>
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

function PlaceholderSection({
  icon,
  title,
  badge,
  detail
}: {
  icon: ReactNode;
  title: string;
  badge: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle>{title}</CardTitle>
          </div>
          <Badge variant="outline">{badge}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <EmptyState title="Pending evidence" detail={detail} />
      </CardContent>
    </Card>
  );
}
