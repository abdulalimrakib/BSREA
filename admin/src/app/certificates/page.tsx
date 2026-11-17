"use client";

import { toast } from "sonner";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can, useStaff } from "@/components/auth-gate";
import { formatDateTime, Loading, StatusBadge, useApi } from "@/components/common";
import { certificatePdfUrl, getCertificates, revokeCertificate } from "@/lib/api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3004";

export default function CertificatesPage() {
  const { staff } = useStaff();
  const { data, error, reload } = useApi(getCertificates);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Certificates</h1>
      {!data ? (
        <Loading error={error} />
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No certificates yet. They are issued when an application is approved, or from the Members page.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Valid</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.number}</TableCell>
                <TableCell className="font-medium">{c.company}</TableCell>
                <TableCell className="text-xs">
                  {c.valid_from} → {c.valid_until}
                </TableCell>
                <TableCell className="text-xs">{formatDateTime(c.created_at)}</TableCell>
                <TableCell>
                  <StatusBadge status={c.state} />
                  {c.revoked_reason && <div className="text-xs text-muted-foreground">{c.revoked_reason}</div>}
                </TableCell>
                <TableCell className="space-x-2 text-right whitespace-nowrap">
                  <a href={`${SITE_URL}/verify/${c.verifyCode}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="size-3.5" /> Verify page
                  </a>
                  {c.state !== "revoked" && (
                    <a href={certificatePdfUrl(c.id)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Download className="size-3.5" /> PDF
                    </a>
                  )}
                  {c.status === "valid" && can(staff, "approve") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        const reason = window.prompt(`Why revoke ${c.number}? (at least 5 characters)`);
                        if (!reason) return;
                        try {
                          await revokeCertificate(c.id, reason);
                          toast.success("Certificate revoked");
                          reload();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Could not revoke");
                        }
                      }}
                    >
                      Revoke
                    </Button>
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
