"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, FileSearch, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, FilterTabs, Loading, membershipLabel, PageHeader, SearchBox, StatusBadge, timeAgo, formatDateTime, useApi } from "@/components/common";
import { getApplications, type ApplicationListItem } from "@/lib/api";

type Show = "open" | "check" | "approved" | "rejected" | "all";

const isOpen = (a: ApplicationListItem) => a.status === "submitted" || a.status === "under_review";
const needsCheck = (a: ApplicationListItem) => isOpen(a) && a.flags > 0 && !a.duplicatesChecked;

/*--What has to happen next, in plain words--*/
function nextStep(a: ApplicationListItem): { text: string; warn?: boolean } {
  if (a.status === "approved") return { text: "Done: now a member" };
  if (a.status === "rejected") return { text: "Done: turned down" };
  if (needsCheck(a)) return { text: `Compare with ${a.flags} similar record${a.flags === 1 ? "" : "s"}`, warn: true };
  if (a.status === "submitted") return { text: "Start the review" };
  return { text: "Ready for a decision" };
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [show, setShow] = useState<Show>("open");
  const [q, setQ] = useState("");
  // The server sends at most the 500 newest of "all", so waiting ones are fetched on their own too: an old waiting application must never drop off the list
  const { data, error, reload } = useApi(async () => {
    const [open, all] = await Promise.all([getApplications("open"), getApplications("all")]);
    const seen = new Set(all.map((a) => a.id));
    return [...all, ...open.filter((a) => !seen.has(a.id))];
  });

  // The home page links here with ?show=check
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("show");
    if (wanted && ["open", "check", "approved", "rejected", "all"].includes(wanted)) setShow(wanted as Show);
  }, []);

  const counts = useMemo(() => {
    const list = data ?? [];
    return {
      open: list.filter(isOpen).length,
      check: list.filter(needsCheck).length,
      approved: list.filter((a) => a.status === "approved").length,
      rejected: list.filter((a) => a.status === "rejected").length,
      all: list.length,
    };
  }, [data]);

  const rows = useMemo(() => {
    const words = q.trim().toLowerCase();
    return (data ?? [])
      .filter((a) => (show === "open" ? isOpen(a) : show === "check" ? needsCheck(a) : show === "all" ? true : a.status === show))
      .filter((a) => !words || [a.company, a.applicant_name, a.reference].some((v) => v?.toLowerCase().includes(words)));
  }, [data, show, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Membership applications"
        description="Companies that filled in the membership form on the website. Open one to check its details and documents, then approve or reject it."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          label="Which applications to show"
          value={show}
          onChange={setShow}
          options={[
            { value: "open", label: "Waiting", count: data ? counts.open : undefined },
            { value: "check", label: "Needs duplicate check", count: data ? counts.check : undefined, warn: true },
            { value: "approved", label: "Approved", count: data ? counts.approved : undefined },
            { value: "rejected", label: "Rejected", count: data ? counts.rejected : undefined },
            { value: "all", label: "All", count: data ? counts.all : undefined },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Search company, applicant or reference" />
      </div>

      {!data ? (
        <Loading error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        q ? (
          <EmptyState icon={FileSearch} title={`Nothing matches “${q}”`}>
            Check the spelling, or try the company name only. You are searching in <strong>{show === "all" ? "all applications" : `“${show === "open" ? "Waiting" : show === "check" ? "Needs duplicate check" : show}”`}</strong>.
          </EmptyState>
        ) : (
          <EmptyState icon={Inbox} tone="good" title={show === "open" || show === "check" ? "Nothing is waiting, well done" : "No applications here yet"} />
        )
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">Company</TableHead>
                <TableHead className="hidden md:table-cell">Membership</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next step</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const step = nextStep(a);
                return (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => router.push(`/applications/${a.id}`)}>
                    <TableCell className="py-3 pl-4">
                      <Link href={`/applications/${a.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {a.company}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {a.applicant_name} · <span className="font-mono">{a.reference}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{membershipLabel(a.origin, a.membership_type)}</TableCell>
                    <TableCell className="text-sm" title={formatDateTime(a.created_at)}>
                      {timeAgo(a.created_at)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {step.warn ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="size-4" /> {step.text}
                        </span>
                      ) : (
                        <span className={isOpen(a) ? "font-medium" : "text-muted-foreground"}>{step.text}</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4">
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
