"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="w-full max-w-lg rounded-md border bg-card p-6">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">Atlas could not render this view.</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button className="mt-6" onClick={reset}>
          Retry
        </Button>
      </section>
    </main>
  );
}
