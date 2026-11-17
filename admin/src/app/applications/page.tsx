"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, Loading, StatusBadge, useApi } from "@/components/common";
import { getApplications } from "@/lib/api";
import { cn } from "@/lib/utils";

const tabs = [
  { value: "open", label: "Open" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export default function ApplicationsPage() {
  const [status, setStatus] = useState("open");
  const { data, error } = useApi(() => getApplications(status), [status]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Membership applications</h1>
      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setStatus(t.value)}
            className={cn("rounded-md px-3 py-1.5 text-sm", status === t.value ? "bg-primary text-primary-foreground" : "bg-secondary")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {!data ? (
        <Loading error={error} />
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No applications here.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Duplicates</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/applications/${a.id}`} className="underline-offset-2 hover:underline">
                    {a.reference}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/applications/${a.id}`} className="font-medium hover:underline">
                    {a.company}
                  </Link>
                  <div className="text-xs text-muted-foreground">{a.applicant_name}</div>
                </TableCell>
                <TableCell className="capitalize">
                  {a.origin} {a.membership_type}
                </TableCell>
                <TableCell>{formatDateTime(a.created_at)}</TableCell>
                <TableCell>
                  {a.flags === 0 ? (
                    <span className="text-xs text-muted-foreground">None</span>
                  ) : a.duplicatesChecked ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                      <CheckCircle2 className="size-3.5" /> {a.flags} checked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                      <AlertTriangle className="size-3.5" /> {a.flags} to check
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={a.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
