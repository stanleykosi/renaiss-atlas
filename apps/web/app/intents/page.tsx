import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { getIntentBoard } from "@/lib/intent-data";
import { cn } from "@/lib/utils";

import { IntentBoardWorkspace } from "./_components/intent-board-workspace";

export default async function IntentsPage() {
  const overview = await getIntentBoard();

  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs text-primary uppercase">Intents</p>
            <h1 className="mt-2 text-3xl font-semibold">Intent Board</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Source-aware collector demand, deterministic matching, and seller-facing reasons.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/market" className={cn(buttonVariants({ variant: "secondary" }))}>
              Market
            </Link>
            <Link href="/wallet" className={cn(buttonVariants({ variant: "ghost" }))}>
              Wallet
            </Link>
          </div>
        </header>

        <IntentBoardWorkspace initialData={overview} />
      </div>
    </main>
  );
}
