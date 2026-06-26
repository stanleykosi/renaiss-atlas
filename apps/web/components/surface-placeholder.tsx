import Link from "next/link";
import { CircleAlert, Clock, Database } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SurfacePlaceholderProps = {
  title: string;
  eyebrow: string;
  emptyState: string;
};

export function SurfacePlaceholder({ title, eyebrow, emptyState }: SurfacePlaceholderProps) {
  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs text-primary uppercase">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
          </div>
          <Link href="/" className={cn(buttonVariants({ variant: "secondary" }))}>
            Home
          </Link>
        </header>

        <section className="mt-8 rounded-md border bg-card p-6">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 text-accent" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-medium">Empty state</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {emptyState}
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-6 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Database className="h-4 w-4 text-primary" aria-hidden="true" />
            Source: scaffold only
          </div>
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
            Freshness: missing until seed/live sync is implemented
          </div>
        </footer>
      </div>
    </main>
  );
}
