"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function WalletAddressError({
  error,
  reset
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="w-full max-w-lg rounded-md border bg-card p-6">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">Wallet copilot failed to load.</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={reset}>Retry</Button>
          <Link href="/market" className={cn(buttonVariants({ variant: "secondary" }))}>
            Market
          </Link>
        </div>
      </section>
    </main>
  );
}
