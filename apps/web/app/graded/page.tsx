import Link from "next/link";
import { BadgeCheck, Database, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  atlasCardHref,
  formatUsdCents,
  lookupRenaissOsGradedCert
} from "@/lib/renaiss-os/data";
import type { RenaissOsGradedLookup } from "@/lib/renaiss-os/schemas";
import { cn } from "@/lib/utils";

type GradedPageProps = {
  searchParams: Promise<{ cert?: string }>;
};

export default async function GradedPage({ searchParams }: GradedPageProps) {
  const params = await searchParams;
  const cert = params.cert?.trim() ?? "";
  const lookup = cert.length > 0 ? await lookupRenaissOsGradedCert(cert) : null;

  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs text-primary uppercase">Graded Cert Lookup</p>
            <h1 className="mt-2 text-3xl font-semibold">Certification Evidence</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Lookup is proxied server-side through Renaiss OS. Atlas never asks for wallet signatures, approvals, private keys, or custody.
            </p>
          </div>
          <Link href="/market" className={cn(buttonVariants({ variant: "secondary" }))}>
            Market pulse
          </Link>
        </header>

        <form action="/graded" className="rounded-md border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input name="cert" defaultValue={cert} className="pl-9" placeholder="Enter PSA/BGS/CGC cert number" />
            </div>
            <button className={cn(buttonVariants(), "md:w-40")} type="submit">
              Lookup
            </button>
          </div>
        </form>

        {lookup == null ? (
          <EmptyState title="Enter a cert" detail="Use a graded cert number to continue into Renaiss lookup data." />
        ) : (
          <LookupResult lookup={lookup} />
        )}
      </div>
    </main>
  );
}

function LookupResult({ lookup }: { lookup: RenaissOsGradedLookup }) {
  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              <CardTitle>Lookup Result</CardTitle>
            </div>
            <Badge variant={lookup.found ? "default" : "warning"}>{lookup.found ? "found" : "not found"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm">
            <Metric label="Cert" value={lookup.certNumber || lookup.cert} />
            <Metric label="Company" value={lookup.company ?? "Unknown"} />
            <Metric label="Grade" value={lookup.gradeLabel ?? lookup.grade ?? "Unknown"} />
            <Metric label="Reason" value={lookup.reason ?? "N/A"} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Matched Card</CardTitle>
        </CardHeader>
        <CardContent>
          {lookup.card == null ? (
            <EmptyState title="No card match yet" detail="Renaiss OS did not return a priced card match for this cert." />
          ) : (
            <Link
              href={atlasCardHref(lookup.card)}
              className="grid gap-4 rounded-md border bg-secondary/30 p-4 transition-colors hover:bg-secondary sm:grid-cols-[96px_1fr]"
            >
              {(lookup.card.imageUrlThumb ?? lookup.card.imageUrl) == null ? (
                <div className="grid aspect-square place-items-center rounded-md border bg-card">
                  <Database className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
              ) : (
                <img
                  src={lookup.card.imageUrlThumb ?? lookup.card.imageUrl ?? ""}
                  alt=""
                  className="aspect-square rounded-md border object-cover"
                />
              )}
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={lookup.card.confidence === "prime" || lookup.card.confidence === "high" ? "default" : "secondary"}>
                    {lookup.card.confidence ?? "unknown"}
                  </Badge>
                  <Badge variant="outline">{lookup.card.gradeLabel}</Badge>
                </div>
                <h2 className="mt-3 text-lg font-semibold">{lookup.card.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lookup.card.setCode ?? lookup.card.setName ?? "Unknown set"} #{lookup.card.cardNumber ?? "N/A"}
                </p>
                <p className="mt-3 font-mono text-lg">{formatUsdCents(lookup.card.priceUsdCents)}</p>
                <span className={cn(buttonVariants({ variant: "secondary", className: "mt-4 w-fit" }))}>
                  Open card intelligence
                </span>
              </div>
            </Link>
          )}
        </CardContent>
      </Card>
    </section>
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
