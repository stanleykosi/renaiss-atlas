import Link from "next/link";
import type { ReactNode } from "react";
import { KeyRound, ShieldCheck, Sparkles, TimerReset } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const proxyRoutes = [
  "/v1/indices",
  "/v1/indices/:game",
  "/v1/cards/featured",
  "/v1/search",
  "/v1/cards/:game/:set/:card",
  "/v1/cards/:game/:set/:card/trades",
  "/v1/cards/:game/:set/:card/series",
  "/v1/cards/:game/:set/:card/fmv-series",
  "/v1/trades/recent",
  "/v1/sets/:game/:set",
  "/v1/graded/:cert",
  "/v1/graded/:cert/stream"
] as const;

export default function SourcesPage() {
  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs text-primary uppercase">Data & Safety</p>
            <h1 className="mt-2 text-3xl font-semibold">Renaiss API, Server-Side Secrets</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Atlas is centered on the Renaiss OS Index API. Scores and AI memos use structured Renaiss data returned through
              the backend.
            </p>
          </div>
          <Link href="/market" className={cn(buttonVariants({ variant: "secondary" }))}>
            Market pulse
          </Link>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <SafetyCard
            icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
            title="Renaiss Data"
            detail="Market pulse, search, card intelligence, trades, FMV series, sets, and cert lookup come from api.renaissos.com."
          />
          <SafetyCard
            icon={<KeyRound className="h-5 w-5" aria-hidden="true" />}
            title="Secret Boundary"
            detail="X-Api-Key and X-Api-Secret are only attached by the server-side RenaissOSClient. They are never sent to client components."
          />
          <SafetyCard
            icon={<TimerReset className="h-5 w-5" aria-hidden="true" />}
            title="Rate Limits"
            detail="Atlas proxies expose upstream rate-limit headers and uses Redis for cache and Retry-After backoff state when configured."
          />
        </section>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              <CardTitle>How Atlas Uses Renaiss Data</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm text-muted-foreground">
              <PolicyItem
                label="Renaiss API only"
                detail="Every page and proxy route reads from the Renaiss OS Index API. Atlas does not blend legacy connector data."
              />
              <PolicyItem
                label="Scores are deterministic interpretations"
                detail="Atlas scores translate confidence, trades, FMV history, freshness, and activity into readable labels."
              />
              <PolicyItem
                label="OpenRouter memo is validated"
                detail="The AI memo receives structured Renaiss data only, must cite supplied Renaiss reference IDs, and is rejected if OpenRouter is missing, unsafe, or off schema."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backend Proxy Surface</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {proxyRoutes.map((route) => (
                <div key={route} className="rounded-md border bg-secondary/30 px-3 py-2 font-mono text-sm">
                  {route}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What Atlas Hides or Caps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm text-muted-foreground">
              <PolicyItem label="No API-key frontend usage" detail="Browser code calls Atlas routes or server components only." />
              <PolicyItem label="No unsupported predictions" detail="Scores describe evidence quality and liquidity readiness, not guaranteed upside." />
              <PolicyItem label="No trade execution" detail="Recommendations are informational. Atlas does not list, buy, sell, approve tokens, or request signatures." />
              <PolicyItem label="Renaiss API only" detail="Legacy marketplace, pack, wallet, bundle, intent, and external-comparison modules have been removed from the product surface." />
              <PolicyItem label="No mock demand" detail="Atlas does not synthesize demand, wallet P&L, or intent matches outside the Renaiss data set." />
              <PolicyItem label="No AI fallback memo" detail="If OpenRouter does not return validated output, Atlas shows the failure state instead of fabricating a memo." />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function SafetyCard({
  icon,
  title,
  detail
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function PolicyItem({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-md border bg-secondary/30 p-3">
      <Badge variant="outline">{label}</Badge>
      <p className="mt-2">{detail}</p>
    </div>
  );
}
