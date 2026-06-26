import { SurfacePlaceholder } from "@/components/surface-placeholder";

export default function WalletPage() {
  return (
    <SurfacePlaceholder
      eyebrow="Wallet"
      title="Wallet Copilot"
      emptyState="Wallet analysis will stay read-only and will not request signatures, approvals, private keys, or seed phrases."
    />
  );
}
