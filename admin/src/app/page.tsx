"use client";

import Link from "next/link";
import { AlertTriangle, BadgeCheck, FileText, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loading, useApi } from "@/components/common";
import { useStaff } from "@/components/auth-gate";
import { getSummary } from "@/lib/api";

export default function Dashboard() {
  const { staff } = useStaff();
  const { data, error } = useApi(getSummary);

  const tiles = data
    ? [
        { label: "Open applications", value: data.applicationsOpen, href: "/applications", Icon: FileText },
        { label: "Need duplicate check", value: data.applicationsFlagged, href: "/applications", Icon: AlertTriangle, warn: data.applicationsFlagged > 0 },
        { label: "Active members", value: data.members, href: "/members", Icon: Users },
        { label: "Valid certificates", value: data.certificatesValid, href: "/certificates", Icon: BadgeCheck },
      ]
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {staff.name}</h1>
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map(({ label, value, href, Icon, warn }) => (
            <Link key={label} href={href}>
              <Card className={warn ? "border-amber-400" : undefined}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                  <Icon className={warn ? "size-4 text-amber-500" : "size-4 text-muted-foreground"} />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold">{value}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
