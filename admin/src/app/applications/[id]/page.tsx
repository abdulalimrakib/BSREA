"use client";

import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can, useStaff } from "@/components/auth-gate";
import { DuplicateList, formatDateTime, Loading, StatusBadge, useApi } from "@/components/common";
import {
  approveApplication,
  documentUrl,
  getApplication,
  markDuplicatesChecked,
  rejectApplication,
  revealField,
  startReview,
  type ApplicationDetail,
} from "@/lib/api";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[170px_1fr] gap-3 border-b py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{children || "—"}</dd>
    </div>
  );
}

/*--An ID number shown masked; approvers can reveal it (the reveal is written to the audit log)--*/
function SecretRow({ app, field, label }: { app: ApplicationDetail; field: "tradeLicenseNo" | "binNo" | "tinNo" | "applicantNid"; label: string }) {
  const { staff } = useStaff();
  const [value, setValue] = useState<string | null>(null);
  if (!app[field]) return <Row label={label}>—</Row>;
  return (
    <Row label={label}>
      <span className="font-mono">{value ?? app[field]}</span>
      {!value && can(staff, "approve") && (
        <button
          type="button"
          className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          onClick={async () => {
            try {
              setValue((await revealField(app.id, field)).value);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not reveal");
            }
          }}
        >
          <Eye className="size-3" /> Reveal (logged)
        </button>
      )}
    </Row>
  );
}

export default function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number(use(params).id);
  const { staff } = useStaff();
  const { data: app, error, reload } = useApi(() => getApplication(id), [id]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!app) return <Loading error={error} />;

  const open = app.status === "submitted" || app.status === "under_review";
  const blocking = app.duplicatesNow.some((m) => m.level === "block");
  const needsCheck = app.duplicatesNow.length > 0 && !app.duplicatesCheckedBy;

  const act = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(done);
      setNote("");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/applications" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Applications
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{app.company}</h1>
        <StatusBadge status={app.status} />
        <span className="font-mono text-xs text-muted-foreground">{app.reference}</span>
      </div>

      <Card className={blocking ? "border-red-400" : needsCheck ? "border-amber-400" : undefined}>
        <CardHeader>
          <CardTitle>Duplicate check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {open ? (
            <>
              <p className="text-xs text-muted-foreground">Checked against all members and open applications just now.</p>
              <DuplicateList matches={app.duplicatesNow} />
              {app.duplicatesCheckedBy && <p className="text-sm text-green-700 dark:text-green-400">Checked and cleared by {app.duplicatesCheckedBy}.</p>}
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">As found when the application was submitted.</p>
              <DuplicateList matches={app.duplicatesAtSubmission} />
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Membership">
                <span className="capitalize">
                  {app.origin} {app.membershipType}
                </span>
              </Row>
              <Row label="Company">{app.company}</Row>
              <SecretRow app={app} field="tradeLicenseNo" label="Trade licence no." />
              <SecretRow app={app} field="binNo" label="BIN" />
              <SecretRow app={app} field="tinNo" label="TIN" />
              <Row label="Email">{app.companyEmail}</Row>
              <Row label="Phone">{app.companyPhone}</Row>
              <Row label="Address">{app.address}</Row>
              <Row label="Website">
                {app.website && (
                  <a href={app.website} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
                    {app.website}
                  </a>
                )}
              </Row>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Applicant</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Name">{app.applicantName}</Row>
              <Row label="Designation">{app.applicantDesignation}</Row>
              <Row label="Email">{app.applicantEmail}</Row>
              <Row label="Mobile">{app.applicantMobile}</Row>
              <SecretRow app={app} field="applicantNid" label="NID / passport" />
              <Row label="Contact person">{[app.contactName, app.contactMobile, app.contactEmail].filter(Boolean).join(" · ")}</Row>
              <Row label="Submitted">{formatDateTime(app.createdAt)}</Row>
              {app.reviewedAt && (
                <Row label="Decided">
                  {formatDateTime(app.reviewedAt)} by {app.reviewedBy}
                  {app.decisionNote && <div className="text-muted-foreground">“{app.decisionNote}”</div>}
                </Row>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {app.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span>
                  <span className="font-medium">{d.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {d.original_name} · {(d.size / 1024).toFixed(0)} KB
                  </span>
                </span>
                <a href={documentUrl(app.id, d.id)} className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Download className="size-4" /> Download
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Downloads are logged. Files are stored encrypted.</p>
        </CardContent>
      </Card>

      {open && (
        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label htmlFor="note" className="text-sm font-medium">
              Note {needsCheck ? "(why the flagged matches are not duplicates)" : "(reason, required to reject)"}
            </label>
            <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" />
            <div className="flex flex-wrap gap-2">
              {app.status === "submitted" && (
                <Button variant="outline" disabled={busy} onClick={() => act(() => startReview(app.id), "Moved to review")}>
                  Start review
                </Button>
              )}
              {needsCheck && !blocking && (
                <Button variant="outline" disabled={busy || note.trim().length < 5} onClick={() => act(() => markDuplicatesChecked(app.id, note), "Duplicates marked as checked")}>
                  Confirm these are not duplicates
                </Button>
              )}
              {can(staff, "approve") && (
                <>
                  <Button disabled={busy || blocking || needsCheck} onClick={() => act(() => approveApplication(app.id, note), "Approved: member added and certificate issued")}>
                    Approve
                  </Button>
                  <Button variant="destructive" disabled={busy || note.trim().length < 5} onClick={() => act(() => rejectApplication(app.id, note), "Application rejected")}>
                    Reject
                  </Button>
                </>
              )}
            </div>
            {blocking && <p className="text-sm text-destructive">This application matches an existing member or open application exactly, so it can&apos;t be approved.</p>}
            {needsCheck && !blocking && <p className="text-sm text-amber-600">Someone must confirm the flagged matches first. A different person then approves.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
