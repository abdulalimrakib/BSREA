"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can, useStaff } from "@/components/auth-gate";
import { Loading, StatusBadge, useApi } from "@/components/common";
import { getMembers, issueCertificate } from "@/lib/api";

export default function MembersPage() {
  const { staff } = useStaff();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, reload } = useApi(() => getMembers(query), [query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Members {data && <span className="text-muted-foreground">({data.length})</span>}</h1>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, number, name, email" className="max-w-xs" />
      </div>
      {!data ? (
        <Loading error={error} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No.</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Certificate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.member_no}</TableCell>
                <TableCell className="font-medium">{m.company}</TableCell>
                <TableCell className="text-xs">
                  {m.contact_name}
                  <div className="text-muted-foreground">{[m.mobile, m.email].filter(Boolean).join(" · ")}</div>
                </TableCell>
                <TableCell className="capitalize">{m.membership_type}</TableCell>
                <TableCell>
                  <StatusBadge status={m.status} />
                </TableCell>
                <TableCell>
                  {m.valid_certificates > 0 ? (
                    <StatusBadge status="valid" />
                  ) : can(staff, "approve") && m.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await issueCertificate(m.id);
                          toast.success(`Certificate issued for ${m.company}`);
                          reload();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Could not issue");
                        }
                      }}
                    >
                      Issue {new Date().getFullYear()}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">None</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
