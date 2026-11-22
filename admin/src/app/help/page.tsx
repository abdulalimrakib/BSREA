"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleInfo, useStaff } from "@/components/auth-gate";
import { Callout, PageHeader } from "@/components/common";
import type { Role } from "@/lib/api";
import { cn } from "@/lib/utils";

const steps: { title: string; body: ReactNode }[] = [
  {
    title: "Open the application",
    body: (
      <>
        Go to <Link href="/applications" className="font-medium text-primary hover:underline">Applications</Link>. The <em>Waiting</em> list shows everything that needs a decision. Click a company to open it. If you are going to work on it, press <strong>I&apos;m reviewing this</strong> so colleagues know.
      </>
    ),
  },
  {
    title: "Look at the possible duplicates",
    body: (
      <>
        The system compares every application with all members. <strong className="text-red-700 dark:text-red-400">Red</strong> means an exact copy (same company name, trade licence, BIN or TIN): it can&apos;t be approved and should be rejected. <strong className="text-amber-700 dark:text-amber-400">Amber</strong> means it looks similar. Compare them; if they are different companies, press <strong>They are different companies</strong> and say how you know.
      </>
    ),
  },
  {
    title: "Check the details and documents",
    body: "Compare the company name, trade licence and addresses with the uploaded documents. Make sure there is a payment receipt for the membership fee. Download a file to open it.",
  },
  {
    title: "Approve or reject (approvers only)",
    body: (
      <>
        <strong>Approve</strong> adds the company to the member list and creates its certificate. <strong>Reject</strong> needs a short reason. If you confirmed the duplicates yourself, a <em>different</em> approver must approve, so two people always agree.
      </>
    ),
  },
  {
    title: "Send the certificate",
    body: (
      <>
        On <Link href="/certificates" className="font-medium text-primary hover:underline">Certificates</Link>, press <strong>PDF</strong> to download it and email it to the member. Anyone can scan its QR code to see that it is genuine.
      </>
    ),
  },
];

const glossary: [string, string][] = [
  ["Application", "The membership form a company fills in on the BSREA website."],
  ["Member number", "The number BSREA gives a company when it becomes a member, like BSREA-M-0000-0004."],
  ["Trade licence", "The company's business licence number from the city corporation or local council."],
  ["BIN", "Business Identification Number, used for VAT."],
  ["TIN", "Tax Identification Number, from the National Board of Revenue."],
  ["NID", "National ID card number of the person who applied (or their passport number)."],
  ["Possible duplicate", "An application or member that looks like one we already have. Often it is a sister company, so a person checks."],
  ["Partly hidden numbers", "ID numbers are hidden for privacy. Approvers can press “Show full number”; this is recorded."],
  ["Certificate", "The membership certificate (PDF) with a QR code that anyone can scan to check it."],
  ["Verify page / Times verified", "The public web page the QR code opens. Each visit counts as one check."],
  ["Cancel (revoke) a certificate", "Make a certificate invalid straight away, for example when the fee wasn't paid. It can't be undone."],
  ["Expired", "A certificate whose end date has passed."],
  ["Phone login (two-factor)", "Besides your password, you type a 6-digit number from an app on your phone each time you log in."],
  ["Activity log", "A permanent record of who did what and when. Nobody can change it. Only administrators can read it."],
];

export default function HelpPage() {
  const { staff } = useStaff();
  return (
    <div className="space-y-8">
      <PageHeader title="Help & guide" description="Everything you need to review applications and look after members, in plain words." />

      <section aria-labelledby="how" className="space-y-3">
        <h2 id="how" className="text-lg font-semibold">
          How to review an application
        </h2>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-xl border bg-card p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">{i + 1}</span>
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="roles" className="space-y-3">
        <h2 id="roles" className="text-lg font-semibold">
          Who can do what
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(["staff", "approver", "admin"] as Role[]).map((r) => (
            <Card key={r} className={cn("gap-3", staff.role === r && "border-primary ring-2 ring-primary/20")}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {roleInfo[r].label}
                  {staff.role === r && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary">You</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{roleInfo[r].can}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="words" className="space-y-3">
        <h2 id="words" className="text-lg font-semibold">
          What the words mean
        </h2>
        <Card className="py-2">
          <dl className="divide-y">
            {glossary.map(([term, meaning]) => (
              <div key={term} className="grid gap-1 px-6 py-3 text-sm sm:grid-cols-[220px_1fr] sm:gap-4">
                <dt className="font-medium">{term}</dt>
                <dd className="text-muted-foreground">{meaning}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>

      <Callout tone="info" title="Stuck, or something looks wrong?">
        Forgot your password, lost your phone, or see something strange? Ask an administrator. They can reset your phone login and see the activity log. Your own password and phone login are under{" "}
        <Link href="/account" className="font-medium underline">
          My account
        </Link>
        .
      </Callout>
    </div>
  );
}
