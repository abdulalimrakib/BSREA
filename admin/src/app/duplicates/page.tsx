"use client";

import Link from "next/link";
import { Copy, Mail, Phone, Type } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Callout, EmptyState, Loading, PageHeader, useApi } from "@/components/common";
import { getMemberDuplicates } from "@/lib/api";

const reasonIcon = (reason: string) => (/mail/i.test(reason) ? Mail : /phone|mobile/i.test(reason) ? Phone : /name/i.test(reason) ? Type : Copy);

/*--Possible duplicates already in the member list (shared email/phone, very similar names)--*/
export default function DuplicatesPage() {
  const { data, error, reload } = useApi(getMemberDuplicates);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            Possible duplicate members {data && data.length > 0 && <span className="font-normal text-muted-foreground">({data.length})</span>}
          </>
        }
        description="Groups of members that share an email address or phone number, or have very similar names. This page only shows them; nothing changes automatically."
      />
      <Callout tone="info" title="Is it really a duplicate?">
        Often it isn&apos;t: sister companies with the same owner often share an email or phone. Look at each group and decide. Exact duplicates (same company name, trade licence, BIN or TIN) can&apos;t happen: the system refuses them.
      </Callout>
      {!data ? (
        <Loading error={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState tone="good" title="No possible duplicates found" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((g, i) => {
            const Icon = reasonIcon(g.reason);
            return (
              <Card key={i} className="gap-3 py-5">
                <CardContent className="space-y-3">
                  <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 text-xs">
                    <Icon /> {g.reason}
                    {g.score ? ` · ${Math.round(g.score * 100)}% alike` : ""}
                  </Badge>
                  <ul className="divide-y rounded-lg border">
                    {g.members.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <Link href={`/members?q=${encodeURIComponent(m.member_no)}`} className="font-medium hover:underline">
                          {m.company}
                        </Link>
                        <span className="font-mono text-xs text-muted-foreground">{m.member_no}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
