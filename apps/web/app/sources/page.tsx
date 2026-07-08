import { SurfacePlaceholder } from "@/components/surface-placeholder";

export default function SourcesPage() {
  return (
    <SurfacePlaceholder
      eyebrow="Sources"
      title="Data Sources and Safety"
      emptyState="Live source records, freshness labels, confidence labels, and data-quality warnings appear here after sync jobs run."
    />
  );
}
