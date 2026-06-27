import Link from "next/link";

import { getMarketOverview } from "@/lib/market-data";
import { MarketWorkspace } from "./_components/market-workspace";

export default async function MarketPage() {
  const overview = await getMarketOverview();

  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs text-primary uppercase">Market</p>
            <h1 className="mt-2 text-3xl font-semibold">Market Health Map</h1>
          </div>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            Home
          </Link>
        </header>

        <MarketWorkspace initialData={overview} />
      </div>
    </main>
  );
}
