"use client";

import Link from "next/link";
import { use, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeft, Building2, Check, CheckCircle2, Circle, Copy, Download, Eye, FileText, Lock, UserRound, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { can, useStaff } from "@/components/auth-gate";
import { Callout, ConfirmDialog, DuplicateList, formatDateTime, Loading, membershipLabel, StatusBadge, timeAgo, useApi } from "@/components/common";
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
import { cn } from "@/lib/utils";

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-2.5 text-sm last:border-0 sm:grid-cols-[180px_1fr] sm:gap-3">
      <dt className="text-muted-foreground">
        {label}
        {hint && <span className="block text-xs opacity-80">{hint}</span>}
      </dt>
      <dd className="break-words">{children || "—"}</dd>
    </div>
  );
}

type SecretField = "tradeLicenseNo" | "binNo" | "tinNo" | "applicantNid";

/*--An ID number shown partly hidden; approvers can show it in full (that is written to the activity log)--*/
function SecretRow({ app, field, label, hint }: { app: ApplicationDetail; field: SecretField; label: string; hint?: string }) {
  const { staff } = useStaff();
  const [value, setValue] = useState<string | null>(null);
  if (!app[field]) return <Row label={label} hint={hint}>—</Row>;
  return (
    <Row label={label} hint={hint}>
      <span className="font-mono">{value ?? app[field]}</span>
      {!value &&
        (can(staff, "approve") ? (
          <button
            type="button"
            title="The number is partly hidden for privacy. Showing it in full is recorded in the activity log."
            className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent"
            onClick={async () => {
              try {
                setValue((await revealField(app.id, field)).value);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not show the number");
              }
            }}
          >
            <Eye className="size-3.5" /> Show full number
          </button>
        ) : (
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground" title="Only approvers can see the full number">
            <Lock className="size-3" /> partly hidden
          </span>
        ))}
    </Row>
  );
}

/*--The four stages an application goes through--*/
function Progress({ app }: { app: ApplicationDetail }) {
  const decided = app.status === "approved" || app.status === "rejected";
  const dupDone = decided || app.duplicatesNow.length === 0 || !!app.duplicatesCheckedBy;
  const steps = [
    { label: "Received", sub: timeAgo(app.createdAt), done: true },
    { label: "Review started", sub: app.status === "submitted" ? "Not yet" : "Yes", done: app.status !== "submitted" },
    { label: "Duplicates checked", sub: app.duplicatesNow.length === 0 && !decided ? "None found" : dupDone ? "Done" : "Waiting", done: dupDone },
    {
      label: app.status === "rejected" ? "Rejected" : app.status === "approved" ? "Approved" : "Decision",
      sub: decided ? timeAgo(app.reviewedAt) : "Waiting",
      done: decided,
      bad: app.status === "rejected",
    },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s.label} className={cn("flex items-center gap-3 rounded-lg border bg-card p-3", i === current && "border-primary ring-2 ring-primary/20")}>
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              s.bad ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : s.done ? "bg-primary text-primary-foreground" : i === current ? "border-2 border-primary text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {s.bad ? <X className="size-4" /> : s.done ? <Check className="size-4" /> : i + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{s.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{s.sub}</span>
          </span>
          <span className="sr-only">{s.done ? "(done)" : i === current ? "(current step)" : "(not yet)"}</span>
        </li>
      ))}
    </ol>
  );
}

function CheckItem({ ok, warn, children }: { ok: boolean; warn?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> : warn ? <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <span>{children}</span>
    </li>
  );
}

type DialogName = "approve" | "reject" | "clear" | null;

export default function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number(use(params).id);
  const { staff } = useStaff();
  const { data: app, error, reload } = useApi(() => getApplication(id), [id]);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [busy, setBusy] = useState(false);

  if (!app) return <Loading error={error} onRetry={reload} />;

  const open = app.status === "submitted" || app.status === "under_review";
  const blocking = app.duplicatesNow.some((m) => m.level === "block");
  const needsCheck = app.duplicatesNow.length > 0 && !app.duplicatesCheckedBy;
  const clearedByMe = !!app.duplicatesCheckedBy && app.duplicatesCheckedBy === staff.name && app.duplicatesNow.length > 0;
  const hasReceipt = app.documents.some((d) => d.kind === "payment_receipt");
  const isApprover = can(staff, "approve");
  const canApprove = isApprover && !blocking && !needsCheck && !clearedByMe;

  const run = async (work: () => Promise<unknown>, done: string) => {
    await work();
    toast.success(done);
    reload();
  };

  const startReviewNow = async () => {
    setBusy(true);
    try {
      await run(() => startReview(app.id), "Review started. Other staff can see you're working on it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  /*--The one sentence that tells staff what to do now--*/
  const nextText = !open
    ? null
    : blocking
      ? "This application can't be approved because it exactly matches an existing member or another application. It should be rejected."
      : needsCheck
        ? "Look at the possible duplicates below. If they are different companies (for example, sister companies), confirm it with the button."
        : clearedByMe
          ? "You confirmed the possible duplicates, so a different approver must make the decision (two people must agree)."
          : isApprover
            ? "Check the company details and documents. If everything is in order and the fee was paid, approve it."
            : "Check the details and documents. An approver will make the final decision.";

  return (
    <div className="space-y-6">
      <Link href="/applications" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All applications
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{app.company}</h1>
            <StatusBadge status={app.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {membershipLabel(app.origin, app.membershipType)} · Reference <span className="font-mono">{app.reference}</span> · Sent {formatDateTime(app.createdAt)}
          </p>
        </div>
      </div>

      <Progress app={app} />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="order-2 space-y-6 lg:order-1">
          <Card className={blocking ? "border-red-400" : needsCheck ? "border-amber-400" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="size-5 text-muted-foreground" /> Possible duplicates
              </CardTitle>
              <CardDescription>
                {open
                  ? "We compared this application with every member and every other waiting application just now."
                  : "What we found when the application was sent in."}{" "}
                <strong>Red</strong> means an exact match (it can&apos;t be approved). <strong>Amber</strong> means it looks similar and a person should compare.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DuplicateList matches={open ? app.duplicatesNow : app.duplicatesAtSubmission} />
              {open && app.duplicatesCheckedBy && (
                <p className="inline-flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                  <CheckCircle2 className="size-4" /> {app.duplicatesCheckedBy} compared them and confirmed they are different companies.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-5 text-muted-foreground" /> Company
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <Row label="Company name">{app.company}</Row>
                <Row label="Membership">{membershipLabel(app.origin, app.membershipType)}</Row>
                <SecretRow app={app} field="tradeLicenseNo" label="Trade licence no." />
                <SecretRow app={app} field="binNo" label="BIN" hint="Business Identification Number (VAT)" />
                <SecretRow app={app} field="tinNo" label="TIN" hint="Tax Identification Number" />
                <Row label="Email">{app.companyEmail && <a href={`mailto:${app.companyEmail}`} className="text-primary hover:underline">{app.companyEmail}</a>}</Row>
                <Row label="Phone">{app.companyPhone && <a href={`tel:${app.companyPhone}`} className="text-primary hover:underline">{app.companyPhone}</a>}</Row>
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
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-5 text-muted-foreground" /> Person who applied
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <Row label="Name">{app.applicantName}</Row>
                <Row label="Job title">{app.applicantDesignation}</Row>
                <Row label="Email">{app.applicantEmail && <a href={`mailto:${app.applicantEmail}`} className="text-primary hover:underline">{app.applicantEmail}</a>}</Row>
                <Row label="Mobile">{app.applicantMobile && <a href={`tel:${app.applicantMobile}`} className="text-primary hover:underline">{app.applicantMobile}</a>}</Row>
                <SecretRow app={app} field="applicantNid" label="NID / passport" hint="National ID card or passport number" />
                <Row label="Other contact person">{[app.contactName, app.contactMobile, app.contactEmail].filter(Boolean).join(" · ")}</Row>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5 text-muted-foreground" /> Documents ({app.documents.length})
              </CardTitle>
              <CardDescription>Files the applicant uploaded. They are stored encrypted, and every download is recorded.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!hasReceipt && (
                <Callout tone="danger" title="No payment receipt">
                  The applicant didn&apos;t upload a receipt for the membership fee. Confirm the fee was received before approving.
                </Callout>
              )}
              {app.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents were uploaded.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {app.documents.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <span className="flex min-w-0 items-center gap-3">
                        <FileText className="size-5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block font-medium">{d.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {d.original_name} · {(d.size / 1024).toFixed(0)} KB
                          </span>
                        </span>
                      </span>
                      <Button asChild variant="outline" size="sm">
                        <a href={documentUrl(app.id, d.id)}>
                          <Download /> Download
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="order-1 lg:sticky lg:top-6 lg:order-2">
          {open ? (
            <Card className="border-primary/40 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">What to do next</CardTitle>
                <CardDescription className="text-foreground/80">{nextText}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <ul className="space-y-2">
                  <CheckItem ok={!needsCheck && !blocking} warn={blocking}>
                    {blocking ? "Exact duplicate found" : app.duplicatesNow.length === 0 ? "No duplicates found" : needsCheck ? "Possible duplicates need comparing" : "Duplicates compared"}
                  </CheckItem>
                  <CheckItem ok={hasReceipt} warn={!hasReceipt}>
                    {hasReceipt ? "Payment receipt uploaded" : "No payment receipt"}
                  </CheckItem>
                  <CheckItem ok={app.documents.length > 0}>{app.documents.length} document{app.documents.length === 1 ? "" : "s"} to look at</CheckItem>
                </ul>

                <div className="space-y-2">
                  {needsCheck && !blocking && (
                    <Button className="w-full" variant={isApprover ? "outline" : "default"} onClick={() => setDialog("clear")}>
                      They are different companies
                    </Button>
                  )}
                  {isApprover && (
                    <>
                      <Button className="w-full" variant={canApprove ? "default" : "secondary"} disabled={!canApprove} onClick={() => setDialog("approve")}>
                        <Check /> Approve
                      </Button>
                      <Button className="w-full" variant="outline" onClick={() => setDialog("reject")}>
                        <X /> Reject
                      </Button>
                    </>
                  )}
                  {app.status === "submitted" && (
                    <Button className="w-full" variant="ghost" disabled={busy} onClick={startReviewNow} title="Marks it as “Being reviewed” so others know you're on it">
                      I&apos;m reviewing this
                    </Button>
                  )}
                </div>
                {isApprover && !canApprove && !blocking && (
                  <p className="text-xs text-muted-foreground">{needsCheck ? "Approve unlocks after the possible duplicates are compared." : "A different approver must approve this one."}</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className={app.status === "approved" ? "border-green-400" : "border-red-300"}>
              <CardHeader>
                <CardTitle className="text-lg">{app.status === "approved" ? "Approved" : "Rejected"}</CardTitle>
                <CardDescription>
                  {app.reviewedBy ? `By ${app.reviewedBy}` : ""} {app.reviewedAt ? `on ${formatDateTime(app.reviewedAt)}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {app.decisionNote && <blockquote className="border-l-4 pl-3 text-muted-foreground italic">“{app.decisionNote}”</blockquote>}
                {app.status === "approved" && (
                  <>
                    <p>The company was added to the member list and its certificate was issued.</p>
                    <div className="flex flex-col gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/members?q=${encodeURIComponent(app.company)}`}>See in members</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/certificates?q=${encodeURIComponent(app.company)}`}>See certificate</Link>
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={dialog === "clear"}
        onClose={() => setDialog(null)}
        title="Confirm these are different companies"
        confirmLabel="Yes, they are different"
        reason={{
          label: "How do you know?",
          hint: "For example: “Sister company with the same owner, different trade licence.” This is saved with the application.",
          minLength: 5,
        }}
        onConfirm={(note) => run(() => markDuplicatesChecked(app.id, note), "Saved: the possible duplicates were compared")}
      >
        <p>You are confirming that you compared every amber match and that this is a genuinely separate company.</p>
        <p>To keep things fair, a different approver will make the final decision.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "approve"}
        onClose={() => setDialog(null)}
        title={`Approve ${app.company}?`}
        confirmLabel="Approve and add member"
        reason={{ label: "Note (optional)", hint: "Anything other staff should know about this decision.", minLength: 0, required: false }}
        onConfirm={(note) => run(() => approveApplication(app.id, note), "Approved: the member was added and the certificate issued")}
      >
        <p>This will:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>add the company to the member list with a new member number</li>
          <li>issue this year&apos;s membership certificate</li>
        </ul>
        <p className="font-medium text-foreground">This can&apos;t be undone from here.</p>
        {!hasReceipt && <Callout tone="danger">No payment receipt was uploaded. Only approve if you know the fee was received.</Callout>}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "reject"}
        onClose={() => setDialog(null)}
        title={`Reject ${app.company}?`}
        tone="danger"
        confirmLabel="Reject application"
        reason={{ label: "Reason", hint: "Required. Write it clearly: it is kept with the application.", minLength: 5, placeholder: "For example: the trade licence has expired." }}
        onConfirm={(reason) => run(() => rejectApplication(app.id, reason), "Application rejected")}
      >
        <p>The application will be marked as rejected and can&apos;t be approved later.</p>
      </ConfirmDialog>
    </div>
  );
}
