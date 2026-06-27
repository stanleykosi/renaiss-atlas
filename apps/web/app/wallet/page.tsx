import Link from "next/link";

export default function WalletPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="w-full max-w-lg rounded-md border bg-card p-6">
        <p className="font-mono text-sm text-primary uppercase">Wallet</p>
        <h1 className="mt-3 text-2xl font-semibold">Wallet Copilot</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Open a wallet address route to view read-only holdings, ranked actions, bundles, and share
          summary evidence. Atlas never requests signatures, approvals, private keys, or seed phrases.
        </p>
        <Link
          href="/wallet/0x1111111111111111111111111111111111111111"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Open demo wallet
        </Link>
      </section>
    </main>
  );
}
