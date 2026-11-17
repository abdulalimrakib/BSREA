"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { DuplicateMatch } from "@/lib/api";
import { cn } from "@/lib/utils";

/*--Load data from the API, with loading and error states--*/
export function useApi<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  const reload = useCallback(() => {
    setError(null);
    run()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Something went wrong"));
  }, [run]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}

export function Loading({ error }: { error?: string | null }) {
  return <p className={cn("py-10 text-center text-sm", error ? "text-destructive" : "text-muted-foreground")}>{error ?? "Loading…"}</p>;
}

export const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const statusStyle: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  under_review: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  valid: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  active: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  revoked: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  expired: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={cn("border-0 capitalize", statusStyle[status])}>{status.replace("_", " ")}</Badge>;
}

const fieldNames: Record<string, string> = {
  company: "Company name",
  trade_license: "Trade licence no.",
  bin: "BIN",
  tin: "TIN",
  email: "Email",
  phone: "Phone",
  applicant_nid: "Applicant NID/passport",
  document: "Same document file",
};

/*--A list of possible duplicates: red = blocks approval, amber = needs a person to check--*/
export function DuplicateList({ matches }: { matches: DuplicateMatch[] }) {
  if (!matches.length) return <p className="text-sm text-green-700 dark:text-green-400">No duplicates found.</p>;
  return (
    <ul className="space-y-2">
      {matches.map((m, i) => (
        <li
          key={i}
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            m.level === "block" ? "border-red-300 bg-red-50 dark:bg-red-950/40" : "border-amber-300 bg-amber-50 dark:bg-amber-950/40"
          )}
        >
          <span className="font-semibold">{m.level === "block" ? "Blocks approval" : "Check"}:</span> {fieldNames[m.field] ?? m.field}{" "}
          {m.match === "similar" ? `is similar (${Math.round((m.score ?? 0) * 100)}%) to` : "matches"} {m.against === "member" ? "member" : "application"}{" "}
          <span className="font-medium">{m.label}</span>
        </li>
      ))}
    </ul>
  );
}
