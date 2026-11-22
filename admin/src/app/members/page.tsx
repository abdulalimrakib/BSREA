"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Award, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can, useStaff } from "@/components/auth-gate";
import { ConfirmDialog, EmptyState, Loading, PageHeader, SearchBox, StatusBadge, useApi } from "@/components/common";
import { getMembers, issueCertificate, type Member } from "@/lib/api";

export default function MembersPage() {
  const { staff } = useStaff();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [issuing, setIssuing] = useState<Member | null>(null);
  const year = new Date().getFullYear();

  // Other pages link here with ?q=Company name
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("q");
    if (wanted) setQ(wanted);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setQuery(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, reload } = useApi(() => getMembers(query), [query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            Members {data && <span className="font-normal text-muted-foreground">({data.length.toLocaleString("en-GB")})</span>}
          </>
        }
        description="Every BSREA member company. Search by company name, member number, contact name or email."
      >
        <SearchBox value={q} onChange={setQ} placeholder="Search members" />
      </PageHeader>

      {!data ? (
        <Loading error={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState icon={SearchX} title={query ? `No members match “${query}”` : "No members yet"}>
          {query && "Check the spelling, or search for part of the name only (for example “Solar” instead of “Solar Power Ltd.”)."}
        </EmptyState>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">Company</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Certificate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="py-3 pl-4">
                    <div className="font-medium">{m.company}</div>
                    <div className="font-mono text-xs text-muted-foreground" title="Member number">
                      {m.member_no}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    {m.contact_name}
                    <div className="text-xs text-muted-foreground">{[m.mobile, m.email].filter(Boolean).join(" · ")}</div>
                  </TableCell>
                  <TableCell className="hidden text-sm sm:table-cell">{m.membership_type === "associate" ? "Associate" : "General"}</TableCell>
                  <TableCell>
                    <StatusBadge status={m.status} />
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {m.valid_certificates > 0 ? (
                      <StatusBadge status="valid" />
                    ) : can(staff, "approve") && m.status === "active" ? (
                      <Button size="sm" variant="outline" onClick={() => setIssuing(m)}>
                        <Award /> Issue {year} certificate
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No valid certificate</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ConfirmDialog
        open={!!issuing}
        onClose={() => setIssuing(null)}
        title={`Issue a ${year} certificate?`}
        confirmLabel="Issue certificate"
        onConfirm={async () => {
          if (!issuing) return;
          await issueCertificate(issuing.id);
          toast.success(`Certificate issued for ${issuing.company}`);
          reload();
        }}
      >
        <p>
          A membership certificate for <strong className="text-foreground">{issuing?.company}</strong> will be created. You can download the PDF from the Certificates page, and anyone can check it on the public verify page.
        </p>
        <p>Only do this once the membership fee for {year} has been paid.</p>
      </ConfirmDialog>
    </div>
  );
}
