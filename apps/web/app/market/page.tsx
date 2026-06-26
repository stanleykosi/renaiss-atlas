import { SurfacePlaceholder } from "@/components/surface-placeholder";

export default function MarketPage() {
  return (
    <SurfacePlaceholder
      eyebrow="Market"
      title="Market Health Map"
      emptyState="No live or seed market data is connected in phase 0. Mock data must remain clearly labeled when introduced."
    />
  );
}
