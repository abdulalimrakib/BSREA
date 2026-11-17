"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, Loading, useApi } from "@/components/common";
import { getAuditLog } from "@/lib/api";
import { cn } from "@/lib/utils";

/*--Every login, view, download, reveal and decision. The database refuses edits or deletions of this log.--*/
export default function AuditLogPage() {
  const { data, error } = useApi(getAuditLog);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">The latest 500 entries. Entries can&apos;t be changed or deleted.</p>
      </div>
      {!data ? (
        <Loading error={error} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs whitespace-nowrap">{formatDateTime(e.at)}</TableCell>
                <TableCell className="text-xs">{e.actor_email ?? "public"}</TableCell>
                <TableCell>
                  <code className={cn("text-xs", /failed|locked|blocked|revoked|revealed/.test(e.action) && "font-semibold text-amber-600")}>{e.action}</code>
                </TableCell>
                <TableCell className="text-xs">{e.target_type ? `${e.target_type} #${e.target_id}` : "—"}</TableCell>
                <TableCell className="font-mono text-xs">{e.ip}</TableCell>
                <TableCell className="max-w-[360px] truncate font-mono text-xs" title={e.details ?? ""}>
                  {e.details}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
