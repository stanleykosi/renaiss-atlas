import { SurfacePlaceholder } from "@/components/surface-placeholder";

export default function AdminSyncPage() {
  return (
    <SurfacePlaceholder
      eyebrow="Admin"
      title="Sync Visibility"
      emptyState="Admin sync triggers will require JOB_SECRET bearer auth before any live connector is wired."
    />
  );
}
