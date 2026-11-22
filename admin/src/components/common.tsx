"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, RotateCw, Search, X, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

/*--Shown while a page loads: grey placeholder rows, or the error with a "Try again" button--*/
export function Loading({ error, onRetry, rows = 5 }: { error?: string | null; onRetry?: () => void; rows?: number }) {
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
        <AlertCircle className="size-8 text-destructive" />
        <div>
          <p className="font-medium">This page couldn&apos;t be loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCw /> Try again
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

export const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

/*--"3 hours ago", "2 days ago"; falls back to the date for anything older than a month--*/
export const timeAgo = (iso: string | null) => {
  if (!iso) return "—";
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  const steps: [number, string][] = [
    [3600, "minute"],
    [86400, "hour"],
    [86400 * 30, "day"],
  ];
  let unit = 60;
  for (const [limit, name] of steps) {
    if (seconds < limit) {
      const n = Math.floor(seconds / unit);
      return `${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
    unit = limit;
  }
  return formatDate(iso);
};

/*--"local general" → "Local · General member"--*/
export const membershipLabel = (origin: string | null | undefined, type: string) =>
  `${origin ? `${origin === "foreign" ? "Foreign" : "Local"} · ` : ""}${type === "associate" ? "Associate" : "General"} member`;

/*--Status words staff see, and a one-line explanation shown on hover--*/
const statusInfo: Record<string, { label: string; hint: string; style: string }> = {
  submitted: { label: "New", hint: "Sent in by the applicant; nobody has started reviewing it yet", style: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" },
  under_review: { label: "Being reviewed", hint: "A staff member has started checking it", style: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  approved: { label: "Approved", hint: "Accepted: the company is now a member", style: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
  rejected: { label: "Rejected", hint: "Turned down; the reason is on the application", style: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  active: { label: "Active", hint: "A current member", style: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
  suspended: { label: "Suspended", hint: "Membership is on hold", style: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  valid: { label: "Valid", hint: "The certificate is current and shows as genuine on the verify page", style: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
  revoked: { label: "Cancelled", hint: "Cancelled (revoked) by staff; the verify page says it is no longer valid", style: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  expired: { label: "Expired", hint: "Past its end date", style: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
};

export const statusLabel = (status: string) => statusInfo[status]?.label ?? status.replace(/_/g, " ");

export function StatusBadge({ status }: { status: string }) {
  const info = statusInfo[status];
  return (
    <Badge title={info?.hint} className={cn("border-0", !info && "capitalize", info?.style)}>
      {statusLabel(status)}
    </Badge>
  );
}

/*--Page title, a sentence saying what the page is for, and optional buttons on the right--*/
export function PageHeader({ title, description, children }: { title: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/*--A friendly "nothing here" box--*/
export function EmptyState({ icon: Icon = CheckCircle2, title, children, tone = "neutral" }: { icon?: LucideIcon; title: string; children?: ReactNode; tone?: "neutral" | "good" }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <Icon className={cn("size-9", tone === "good" ? "text-primary" : "text-muted-foreground")} />
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

/*--A coloured box with an explanation or warning--*/
export function Callout({ tone = "info", title, children, className }: { tone?: "info" | "warn" | "danger" | "good"; title?: ReactNode; children?: ReactNode; className?: string }) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100",
    warn: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    danger: "border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
    good: "border-green-300 bg-green-50 text-green-950 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100",
  }[tone];
  const Icon = { info: Info, warn: AlertCircle, danger: AlertCircle, good: CheckCircle2 }[tone];
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cn("flex gap-3 rounded-lg border p-4 text-sm", styles, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

/*--Search box with a magnifier and a clear button--*/
export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (value: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cn("relative w-full sm:w-80", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-lg border border-input bg-card pr-9 pl-9 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/*--A row of filter buttons, each with an optional count--*/
export function FilterTabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (value: T) => void; options: { value: T; label: string; count?: number; warn?: boolean }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border bg-card p-1 shadow-xs">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-white/20" : o.warn && o.count > 0 ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-muted",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/*--A labelled form field with an optional hint underneath--*/
export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/*--A "are you sure?" window. With `reason`, staff must type at least `minLength` characters first.--*/
export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  tone = "default",
  reason,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
  reason?: { label: string; hint?: string; minLength: number; required?: boolean; placeholder?: string };
  onConfirm: (reason: string) => Promise<unknown> | unknown;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setText("");
      setError(null);
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  const needed = reason && reason.required !== false ? reason.minLength : 0;
  const short = text.trim().length < needed;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(text.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border bg-card p-0 text-card-foreground shadow-2xl"
    >
      {open && (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            if (!short && !busy) submit();
          }}
          className="space-y-4 p-6"
        >
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {title}
          </h2>
          {children && <div className="space-y-3 text-sm text-muted-foreground">{children}</div>}
          {reason && (
            <div className="space-y-1.5">
              <label htmlFor={`${id}-reason`} className="text-sm font-medium">
                {reason.label}
              </label>
              <textarea
                id={`${id}-reason`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={reason.placeholder}
                autoFocus
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
              />
              <p className="text-xs text-muted-foreground">
                {reason.hint}
                {needed > 0 && short && ` At least ${needed} characters (${text.trim().length}/${needed}).`}
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Go back
            </Button>
            <Button type="submit" variant={tone === "danger" ? "destructive" : "default"} disabled={busy || short}>
              {busy ? "Please wait…" : confirmLabel}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
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
  if (!matches.length)
    return (
      <p className="inline-flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
        <CheckCircle2 className="size-4" /> No duplicates found.
      </p>
    );
  return (
    <ul className="space-y-2">
      {matches.map((m, i) => (
        <li
          key={i}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm",
            m.level === "block" ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40" : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
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
