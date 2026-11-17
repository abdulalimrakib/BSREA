"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Photo = { full: string; thumb: string; alt: string };

/*--Photo grid; clicking a photo opens it full screen (arrow keys / Esc work)--*/
export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const step = useCallback(
    (by: number) =>
      setOpen((i) =>
        i === null ? i : (i + by + photos.length) % photos.length,
      ),
    [photos.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, step]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, i) => (
          <button
            key={photo.full}
            type="button"
            onClick={() => setOpen(i)}
            className="reveal group relative aspect-[4/3] overflow-hidden rounded-2xl bg-brand-mist shadow-[var(--shadow-soft)]"
            aria-label={`Open photo ${i + 1} of ${photos.length}`}
          >
            <Image
              src={photo.thumb}
              alt={photo.alt}
              fill
              sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-700 ease-[var(--ease-smooth)] group-hover:scale-[1.06]"
            />
          </button>
        ))}
      </div>

      {open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-navy/95 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setOpen(null)}
        >
          <div
            className="relative h-[85vh] w-[92vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={photos[open].full}
              alt={photos[open].alt}
              fill
              sizes="92vw"
              className="object-contain"
            />
          </div>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
            {open + 1} / {photos.length}
          </p>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="size-8" />
          </button>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            className="absolute top-1/2 left-2 -translate-y-1/2 p-2 text-white hover:text-brand-yellow"
          >
            <ChevronLeft className="size-10" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            className="absolute top-1/2 right-2 -translate-y-1/2 p-2 text-white hover:text-brand-yellow"
          >
            <ChevronRight className="size-10" />
          </button>
        </div>
      )}
    </>
  );
}
