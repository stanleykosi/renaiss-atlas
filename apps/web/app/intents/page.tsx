import { SurfacePlaceholder } from "@/components/surface-placeholder";

export default function IntentsPage() {
  return (
    <SurfacePlaceholder
      eyebrow="Intents"
      title="Intent Board"
      emptyState="Intent creation is not yet connected. Future writes will validate input, rate-limit public endpoints, and sanitize user text."
    />
  );
}
