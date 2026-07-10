import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function CardDetailNotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="w-full max-w-lg rounded-md border bg-card p-6">
        <p className="font-mono text-sm text-primary">Card</p>
        <h1 className="mt-3 text-2xl font-semibold">Card not found.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No Renaiss OS card was found for this link.
        </p>
        <Link href="/market" className={cn(buttonVariants({ className: "mt-6" }))}>
          Return to market
        </Link>
      </section>
    </main>
  );
}
