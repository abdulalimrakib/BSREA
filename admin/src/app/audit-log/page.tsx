"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileSearch, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can, useStaff } from "@/components/auth-gate";
import { EmptyState, FilterTabs, formatDateTime, Loading, PageHeader, SearchBox, timeAgo, useApi } from "@/components/common";
import { getAuditLog } from "@/lib/api";
import { describeAction, type AuditCategory } from "@/lib/audit-labels";
import { cn } from "@/lib/utils";

type Show = "all" | "warnings" | AuditCategory;

/*--Every login, view, download, reveal and decision. The database refuses edits or deletions of this log.--*/
export default function AuditLogPage() {
  const { staff } = useStaff();
  const isAdmin = can(staff, "admin");
  const { data, error, reload } = useApi(() => (isAdmin ? getAuditLog() : Promise.resolve([])), [isAdmin]);
  const [show, setShow] = useState<Show>("all");
  const [q, setQ] = useState("");

  const entries = useMemo(() => (data ?? []).map((e) => ({ ...e, info: describeAction(e.action) })), [data]);
  const rows = useMemo(() => {
    const words = q.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (show === "all" || (show === "warnings" ? e.info.tone !== "normal" : e.info.category === show)) &&
        (!words || [e.actor_email, e.info.text, e.details, e.ip, e.action].some((v) => v?.toLowerCase().includes(words))),
    );
  }, [entries, show, q]);
  const count = (s: Show) => entries.filter((e) => s === "all" || (s === "warnings" ? e.info.tone !== "normal" : e.info.category === s)).length;

  if (!isAdmin) return <EmptyState icon={ShieldAlert} title="Only administrators can see the activity log" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description="A record of every login, every application opened, every download and every decision: the latest 500 entries. Nobody, not even an administrator, can change or delete it."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          label="Which activity to show"
          value={show}
          onChange={setShow}
          options={[
            { value: "all", label: "Everything", count: data ? count("all") : undefined },
            { value: "warnings", label: "Warnings", count: data ? count("warnings") : undefined, warn: true },
            { value: "login", label: "Logins" },
            { value: "application", label: "Applications" },
            { value: "certificate", label: "Certificates" },
            { value: "staff", label: "Staff & security" },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Search person, action or details" />
      </div>

      {!data ? (
        <Loading error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon={FileSearch} title="Nothing matches" />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What happened</TableHead>
                <TableHead className="hidden lg:table-cell">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id} className={e.info.tone === "danger" ? "bg-red-50/60 dark:bg-red-950/20" : e.info.tone === "warn" ? "bg-amber-50/60 dark:bg-amber-950/20" : undefined}>
                  <TableCell className="py-3 pl-4 text-sm whitespace-nowrap">
                    {timeAgo(e.at)}
                    <div className="text-xs text-muted-foreground">{formatDateTime(e.at)}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {e.actor_email ?? <span className="text-muted-foreground" title="Someone who wasn't logged in, such as a website visitor or a failed login">Not logged in</span>}
                    {e.ip && <div className="font-mono text-xs text-muted-foreground" title="Internet address the request came from">{e.ip}</div>}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className={cn("font-medium", e.info.tone === "danger" ? "text-red-700 dark:text-red-400" : e.info.tone === "warn" && "text-amber-700 dark:text-amber-400")}>{e.info.text}</span>
                    {e.target_type && (
                      <div className="text-xs text-muted-foreground">
                        {e.target_type === "application" ? (
                          <Link href={`/applications/${e.target_id}`} className="hover:underline">
                            Application #{e.target_id}
                          </Link>
                        ) : (
                          `${e.target_type.replace(/_/g, " ")} #${e.target_id}`
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-[320px] truncate font-mono text-xs text-muted-foreground lg:table-cell" title={e.details ?? ""}>
                    {e.details}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
