import Link from "next/link";
import { ArrowRight, Database, ShieldCheck, Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const entryLinks = [
  { href: "/market", label: "Market Pulse" },
  { href: "/cards", label: "Search Card" },
  { href: "/graded", label: "Cert Lookup" },
  { href: "/sources", label: "Safety" }
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-[0.14em] text-primary uppercase">
          Atlas
        </Link>
        <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
          {entryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-8 pt-20 md:grid-cols-[1.15fr_0.85fr] md:items-end">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Read-only intelligence
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold text-balance md:text-7xl">
            Renaiss Atlas
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            Renaiss market data, deterministic Atlas scoring, and on-demand collector reads for collectors who need
            fast conviction without keys, signatures, custody, or trade execution.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/market" className={cn(buttonVariants())}>
              Open market pulse
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/cards" className={cn(buttonVariants({ variant: "secondary" }))}>
              Search card
            </Link>
          </div>
        </div>

        <div className="grid gap-3">
          <StatusTile
            icon={<Database className="h-5 w-5" aria-hidden="true" />}
            label="Renaiss OS Index"
            value="Renaiss API"
          />
          <StatusTile
            icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
            label="AI memo layer"
            value="OpenRouter"
          />
          <StatusTile
            icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
            label="Safety posture"
            value="read-only"
          />
        </div>
      </section>
    </main>
  );
}

function StatusTile({
  icon,
  label,
  value
}: Readonly<{ icon: React.ReactNode; label: string; value: string }>) {
  return (
    <div className="rounded-md border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-primary">{icon}</div>
        <span className="font-mono text-xs text-muted-foreground uppercase">{value}</span>
      </div>
      <p className="mt-8 text-sm font-medium">{label}</p>
    </div>
  );
}
