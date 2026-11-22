"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Ban, Download, ExternalLink, FileSearch, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can, useStaff } from "@/components/auth-gate";
import { ConfirmDialog, EmptyState, FilterTabs, formatDate, formatDateTime, Loading, PageHeader, SearchBox, StatusBadge, timeAgo, useApi } from "@/components/common";
import { certificatePdfUrl, getCertificates, revokeCertificate, type Certificate } from "@/lib/api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3004";

type Show = "all" | "valid" | "attention" | "expired" | "revoked";

export default function CertificatesPage() {
  const { staff } = useStaff();
  const { data, error, reload } = useApi(getCertificates);
  const [show, setShow] = useState<Show>("all");
  const [q, setQ] = useState("");
  const [revoking, setRevoking] = useState<Certificate | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("show");
    if (wanted && ["all", "valid", "attention", "expired", "revoked"].includes(wanted)) setShow(wanted as Show);
    if (params.get("q")) setQ(params.get("q")!);
  }, []);

  const matches = (c: Certificate, s: Show) => (s === "all" ? true : s === "attention" ? c.suspicious_scans > 0 : c.state === s);
  const count = (s: Show) => (data ?? []).filter((c) => matches(c, s)).length;
  const rows = useMemo(() => {
    const words = q.trim().toLowerCase();
    return (data ?? []).filter((c) => matches(c, show) && (!words || c.company.toLowerCase().includes(words) || c.number.toLowerCase().includes(words)));
  }, [data, show, q]);

  return (
    <div className="space-y-6">
      <PageHeader title="Certificates" description="Membership certificates BSREA has issued. Download a PDF to send to a member, or cancel one that should no longer be valid." />

      <details className="group rounded-lg border bg-card p-4 text-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
          <HelpCircle className="size-4 text-primary" /> What does &ldquo;Times verified&rdquo; mean?
        </summary>
        <div className="mt-3 space-y-2 text-muted-foreground">
          <p>Every certificate has a QR code. When someone scans it, or opens its verify page, it counts as one check. This shows how often each certificate is looked at.</p>
          <p>
            <strong className="text-amber-700 dark:text-amber-400">Amber warning:</strong> a cancelled or expired certificate is still being checked. The company may be showing an old certificate as if it were valid, so contact them.
          </p>
          <p>Opening the verify page from here also counts as a check.</p>
        </div>
      </details>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          label="Which certificates to show"
          value={show}
          onChange={setShow}
          options={[
            { value: "all", label: "All", count: data ? count("all") : undefined },
            { value: "valid", label: "Valid", count: data ? count("valid") : undefined },
            { value: "attention", label: "Needs attention", count: data ? count("attention") : undefined, warn: true },
            { value: "expired", label: "Expired", count: data ? count("expired") : undefined },
            { value: "revoked", label: "Cancelled", count: data ? count("revoked") : undefined },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Search company or certificate number" />
      </div>

      {!data ? (
        <Loading error={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title="No certificates yet">Certificates are created when an application is approved, or from the Members page.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={FileSearch} title="No certificates match" tone={show === "attention" ? "good" : "neutral"}>
          {show === "attention" && !q ? "No old certificates are being checked. Nothing to worry about." : "Try another filter, or check the spelling."}
        </EmptyState>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">Company</TableHead>
                <TableHead>Valid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Times verified</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} className={c.suspicious_scans > 0 ? "bg-amber-50/60 dark:bg-amber-950/20" : undefined}>
                  <TableCell className="py-3 pl-4">
                    <div className="font-medium">{c.company}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {c.number} · issued {formatDate(c.created_at)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(c.valid_from)} – {formatDate(c.valid_until)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.state} />
                    {c.revoked_reason && (
                      <div className="mt-1 max-w-48 text-xs text-muted-foreground" title={c.revoked_reason}>
                        {c.revoked_reason}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="tabular-nums">{c.scans}</div>
                    {c.last_scan_at && (
                      <div className="text-xs text-muted-foreground" title={formatDateTime(c.last_scan_at)}>
                        last {timeAgo(c.last_scan_at)}
                      </div>
                    )}
                    {c.suspicious_scans > 0 && (
                      <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400" title={c.last_suspicious_at ? `Last on ${formatDateTime(c.last_suspicious_at)}` : undefined}>
                        <AlertTriangle className="size-3.5" />
                        {c.suspicious_scans} after it ended
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {c.state !== "revoked" && (
                        <Button asChild size="sm" variant="outline">
                          <a href={certificatePdfUrl(c.id)}>
                            <Download /> PDF
                          </a>
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost" title="Open the public page that shows whether this certificate is genuine">
                        <a href={`${SITE_URL}/verify/${c.verifyCode}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink /> Verify page
                        </a>
                      </Button>
                      {c.status === "valid" && can(staff, "approve") && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRevoking(c)}>
                          <Ban /> Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title="Cancel this certificate?"
        tone="danger"
        confirmLabel="Cancel certificate"
        reason={{ label: "Reason", hint: "Required. It is shown to staff and kept on record.", minLength: 5, placeholder: "For example: membership fee not paid." }}
        onConfirm={async (reason) => {
          if (!revoking) return;
          await revokeCertificate(revoking.id, reason);
          toast.success("Certificate cancelled");
          reload();
        }}
      >
        <p>
          Certificate <span className="font-mono text-foreground">{revoking?.number}</span> for <strong className="text-foreground">{revoking?.company}</strong> will stop being valid straight away. Anyone who scans it will be told it was cancelled.
        </p>
        <p className="font-medium text-foreground">This can&apos;t be undone. A new certificate can be issued from the Members page.</p>
      </ConfirmDialog>
    </div>
  );
}
