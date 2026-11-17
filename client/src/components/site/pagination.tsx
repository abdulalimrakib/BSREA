import Link from "next/link";
import { cn } from "@/lib/utils";

/*--Numbered page links: « Previous 1 2 3 Next »--*/
export default function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <nav
      aria-label="Pagination"
      className="mt-16 flex flex-wrap items-center justify-center gap-2 text-sm"
    >
      {page > 1 && (
        <Link
          href={hrefFor(page - 1)}
          className="rounded-full px-4 py-2 font-medium text-brand-navy transition-colors hover:bg-brand-mint hover:text-brand-green"
        >
          « Previous
        </Link>
      )}
      {pages.map((n) => (
        <Link
          key={n}
          href={hrefFor(n)}
          aria-current={n === page ? "page" : undefined}
          className={cn(
            "flex size-10 items-center justify-center rounded-full border font-semibold transition-all duration-300",
            n === page
              ? "border-brand-green bg-brand-green text-white shadow-[0_8px_20px_-8px_rgb(9_120_52/0.7)]"
              : "border-brand-navy/10 bg-white text-brand-navy hover:-translate-y-0.5 hover:border-brand-green hover:text-brand-green",
          )}
        >
          {n}
        </Link>
      ))}
      {page < totalPages && (
        <Link
          href={hrefFor(page + 1)}
          className="rounded-full px-4 py-2 font-medium text-brand-navy transition-colors hover:bg-brand-mint hover:text-brand-green"
        >
          Next »
        </Link>
      )}
    </nav>
  );
}
