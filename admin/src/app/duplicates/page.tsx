"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading, useApi } from "@/components/common";
import { getMemberDuplicates } from "@/lib/api";

/*--Possible duplicates already in the member list (shared email/phone, very similar names)--*/
export default function DuplicatesPage() {
  const { data, error } = useApi(getMemberDuplicates);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Possible duplicate members</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Members that share an email or phone, or whose names are nearly the same. Many are sister companies with one owner; check each one. Exact
          duplicates (same company name, trade licence, BIN or TIN) can&apos;t exist: the database refuses them.
        </p>
      </div>
      {!data ? (
        <Loading error={error} />
      ) : data.length === 0 ? (
        <p className="text-sm text-green-700">No possible duplicates found.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((g, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 pt-6">
                <Badge variant="secondary">
                  {g.reason}
                  {g.score ? ` · ${Math.round(g.score * 100)}%` : ""}
                </Badge>
                <ul className="text-sm">
                  {g.members.map((m) => (
                    <li key={m.id}>
                      <span className="font-medium">{m.company}</span> <span className="font-mono text-xs text-muted-foreground">{m.member_no}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
