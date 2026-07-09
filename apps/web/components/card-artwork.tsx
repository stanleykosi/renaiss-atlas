import { Database } from "lucide-react";

import { cn } from "@/lib/utils";

type CardArtworkProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
};

export function CardArtwork({ src, alt, className, loading = "lazy" }: CardArtworkProps) {
  const frameClassName = cn(
    "grid aspect-[3/4] place-items-center overflow-hidden rounded-md border bg-card",
    className
  );

  if (src == null || src.length === 0) {
    return (
      <div className={frameClassName}>
        <Database className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={frameClassName}>
      <img
        src={src}
        alt={alt}
        loading={loading}
        className="h-full w-full object-contain p-1"
      />
    </div>
  );
}
