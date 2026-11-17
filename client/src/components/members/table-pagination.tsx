"use client";

import { cn } from "@/lib/utils";

/*--Which page numbers to show: 1 … 4 5 6 … 16--*/
export const pageNumbers = (page: number, total: number): (number | "…")[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set(
    [1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total),
  );
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
};

export default function TablePagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const button =
    "min-w-10 rounded-full border px-3 py-2 font-medium transition-colors duration-200 disabled:cursor-default disabled:opacity-40";
  return (
    <nav aria-label="Table pages" className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        className={cn(button, "border-transparent")}
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      {pageNumbers(page, totalPages).map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} className="px-2">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            aria-current={n === page ? "page" : undefined}
            onClick={() => onChange(n)}
            className={cn(
              button,
              n === page
                ? "border-brand-green bg-brand-green text-white"
                : "border-transparent hover:border-brand-navy/10 hover:bg-white",
            )}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        className={cn(button, "border-transparent")}
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
