"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Member } from "@/lib/content";
import Pagination from "@/components/members/table-pagination";

const PAGE_SIZES = [15, 25, 50, 100];

/*--Searchable, paged member list (the original used DataTables)--*/
export default function MemberTable({ members }: { members: Member[] }) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      Object.values(m).some(
        (value) => value && value.toLowerCase().includes(q),
      ),
    );
  }, [members, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize);
  const from = filtered.length ? (current - 1) * pageSize + 1 : 0;
  const to = Math.min(current * pageSize, filtered.length);

  return (
    <div className="text-sm text-brand-slate">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2">
          Show
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-full border border-brand-navy/10 bg-white px-3 py-2 focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 focus:outline-none"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          entries
        </label>
        <label className="relative flex items-center">
          <span className="sr-only">Search members</span>
          <Search
            className="pointer-events-none absolute left-4 size-4 text-brand-gray"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="w-72 max-w-full rounded-full border border-brand-navy/10 bg-white py-2.5 pr-4 pl-10 shadow-[0_1px_2px_rgb(25_42_61/0.04)] transition-[border-color,box-shadow] focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 focus:outline-none"
            placeholder="Company, name, address…"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-brand-navy/5 bg-white shadow-[var(--shadow-soft)]">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="bg-brand-mist/70 text-left text-brand-navy">
              {[
                "Company Name",
                "Member's Name",
                "Designation",
                "Address",
                "Website",
              ].map((head) => (
                <th
                  key={head}
                  scope="col"
                  className="px-5 py-4 text-xs font-semibold tracking-[0.12em] uppercase"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr
                key={`${m.company}-${m.name}-${i}`}
                className="border-t border-brand-navy/5 transition-colors hover:bg-brand-mint/40"
              >
                <td className="px-5 py-4 font-medium text-brand-navy">
                  {m.company}
                </td>
                <td className="px-5 py-4">{m.name}</td>
                <td className="px-5 py-4">{m.designation}</td>
                <td className="px-5 py-4">{m.address}</td>
                <td className="px-5 py-4">
                  {m.website && (
                    <a
                      href={m.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-brand-green hover:underline"
                    >
                      Details
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center">
                  No matching members found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <p aria-live="polite">
          Showing {from} to {to} of {filtered.length} entries
          {filtered.length !== members.length &&
            ` (filtered from ${members.length} total entries)`}
        </p>
        <Pagination page={current} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}
