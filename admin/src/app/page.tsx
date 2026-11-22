"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, FileText, LifeBuoy, ScanEye, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loading, PageHeader, StatusBadge, timeAgo, useApi } from "@/components/common";
import { roleInfo, useStaff } from "@/components/auth-gate";
import { getApplications, getSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

function TodoItem({ Icon, tone, title, text, href, action }: { Icon: LucideIcon; tone: "warn" | "info"; title: string; text: string; href: string; action: string }) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", tone === "warn" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-accent text-primary")}>
        <Icon className="size-5" />
      </span>
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      <Button asChild variant={tone === "warn" ? "default" : "outline"} className="sm:w-auto">
        <Link href={href}>
          {action} <ArrowRight />
        </Link>
      </Button>
    </li>
  );
}

export default function Dashboard() {
  const { staff } = useStaff();
  const { data, error, reload } = useApi(getSummary);
  const recent = useApi(() => getApplications("open"));

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const todos = data
    ? [
        data.applicationsFlagged > 0 && {
          Icon: AlertTriangle,
          tone: "warn" as const,
          title: `${plural(data.applicationsFlagged, "application looks", "applications look")} like an existing member or application`,
          text: "Someone needs to compare them and confirm they are really different companies before they can be approved.",
          href: "/applications?show=check",
          action: "Check now",
        },
        data.applicationsOpen > 0 && {
          Icon: FileText,
          tone: "info" as const,
          title: `${plural(data.applicationsOpen, "application is", "applications are")} waiting for a decision`,
          text: "Open each one, look at the documents and the payment receipt, then approve or reject it.",
          href: "/applications",
          action: "Review",
        },
        data.certificatesSuspiciousScans > 0 && {
          Icon: ScanEye,
          tone: "warn" as const,
          title: `${plural(data.certificatesSuspiciousScans, "cancelled or expired certificate was", "cancelled or expired certificates were")} checked in the last 30 days`,
          text: "Someone may still be showing an old certificate as if it were valid. Look at which one and contact the company.",
          href: "/certificates?show=attention",
          action: "See which",
        },
      ].filter((t) => !!t)
    : [];

  const stats = data
    ? [
        { label: "Applications waiting", value: data.applicationsOpen, href: "/applications", Icon: FileText },
        { label: "Active members", value: data.members, href: "/members", Icon: Users },
        { label: "Valid certificates", value: data.certificatesValid, href: "/certificates", Icon: BadgeCheck },
      ]
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}, ${staff.name.split(" ")[0]}`}
        description={
          <>
            You are signed in as <span className="font-medium text-foreground">{roleInfo[staff.role].label}</span>. {roleInfo[staff.role].can}
          </>
        }
      />

      {!data ? (
        <Loading error={error} onRetry={reload} rows={3} />
      ) : (
        <>
          <section aria-labelledby="todo">
            <h2 id="todo" className="mb-3 text-lg font-semibold">
              Things to do
            </h2>
            {todos.length ? (
              <Card className="gap-0 py-0">
                <ul className="divide-y">
                  {todos.map((t) => (
                    <TodoItem key={t.title} {...t} />
                  ))}
                </ul>
              </Card>
            ) : (
              <Card className="flex-row items-center gap-4 px-6">
                <CheckCircle2 className="size-8 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">You&apos;re all caught up</p>
                  <p className="text-sm text-muted-foreground">No applications are waiting and nothing needs checking.</p>
                </div>
              </Card>
            )}
          </section>

          <section aria-labelledby="glance">
            <h2 id="glance" className="mb-3 text-lg font-semibold">
              At a glance
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {stats.map(({ label, value, href, Icon }) => (
                <Link key={label} href={href} className="group rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none">
                  <Card className="gap-2 transition-shadow group-hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                      <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                        <Icon className="size-5" />
                      </span>
                    </CardHeader>
                    <CardContent className="flex items-end justify-between">
                      <p className="text-3xl font-semibold tabular-nums">{value.toLocaleString("en-GB")}</p>
                      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="latest" className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="latest" className="text-lg font-semibold">
              Latest applications
            </h2>
            <Link href="/applications" className="text-sm font-medium text-primary hover:underline">
              See all
            </Link>
          </div>
          <Card className="gap-0 py-0">
            {!recent.data ? (
              <div className="p-4">
                <Loading error={recent.error} onRetry={recent.reload} rows={3} />
              </div>
            ) : recent.data.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No applications are waiting right now.</p>
            ) : (
              <ul className="divide-y">
                {recent.data.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link href={`/applications/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{a.company}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.applicant_name} · sent {timeAgo(a.created_at)}
                        </p>
                      </div>
                      {a.flags > 0 && !a.duplicatesChecked && (
                        <span className="hidden items-center gap-1 text-xs font-medium text-amber-700 sm:inline-flex dark:text-amber-400">
                          <AlertTriangle className="size-3.5" /> Needs check
                        </span>
                      )}
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
        <section aria-labelledby="help">
          <h2 id="help" className="mb-3 text-lg font-semibold">
            New here?
          </h2>
          <Card>
            <CardContent className="space-y-3 text-sm">
              <LifeBuoy className="size-8 text-primary" />
              <p>The guide explains, step by step, how to review an application, what each word on the screen means, and who can do what.</p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/help">Open the guide</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
