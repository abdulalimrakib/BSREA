"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ShieldAlert, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can, roleInfo, useStaff } from "@/components/auth-gate";
import { ConfirmDialog, EmptyState, Field, Loading, PageHeader, timeAgo, formatDateTime, useApi } from "@/components/common";
import { createStaff, deactivateStaff, getStaff, resetStaffTwoFactor, type Role, type StaffAccount } from "@/lib/api";
import { cn } from "@/lib/utils";

function AddStaff({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [role, setRole] = useState<Role>("staff");
  const [busy, setBusy] = useState(false);

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const d = new FormData(form);
    setBusy(true);
    try {
      await createStaff({ email: String(d.get("email")), name: String(d.get("name")), role, password: String(d.get("password")) });
      toast.success("Account created. Now give them their email and temporary password.");
      form.reset();
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle>Add a staff member</CardTitle>
        <CardDescription>They will log in with this email and the temporary password. Ask them to change it from “My account” straight away.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onCreate} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="s-name">
              <Input id="s-name" name="name" required minLength={2} />
            </Field>
            <Field label="Email" htmlFor="s-email">
              <Input id="s-email" name="email" type="email" required />
            </Field>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">What can they do?</legend>
            <div className="grid gap-3 md:grid-cols-3">
              {(["staff", "approver", "admin"] as Role[]).map((r) => (
                <label key={r} className={cn("cursor-pointer rounded-lg border p-3 text-sm transition-colors", role === r ? "border-primary bg-accent ring-2 ring-primary/20" : "hover:bg-muted/60")}>
                  <span className="flex items-center gap-2 font-medium">
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="accent-[var(--primary)]" />
                    {roleInfo[r].label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{roleInfo[r].can}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Temporary password" htmlFor="s-password" hint="At least 12 characters, with capital and small letters and a number. Tell them in person or by phone rather than writing it in an email.">
            <Input id="s-password" name="password" type="text" autoComplete="new-password" required minLength={12} className="max-w-sm font-mono" />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add staff member"}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function StaffPage() {
  const { staff } = useStaff();
  const isAdmin = can(staff, "admin");
  const { data, error, reload } = useApi(() => (isAdmin ? getStaff() : Promise.resolve([])), [isAdmin]);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "deactivate" | "reset"; user: StaffAccount } | null>(null);

  if (!isAdmin)
    return (
      <EmptyState icon={ShieldAlert} title="Only administrators can manage staff accounts">
        To change your own password or phone login, go to <strong>My account</strong>.
      </EmptyState>
    );

  return (
    <div className="space-y-6">
      <PageHeader title="Staff accounts" description="Everyone who can log in to this panel, and what they are allowed to do.">
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <UserPlus /> Add staff member
          </Button>
        )}
      </PageHeader>

      {adding && (
        <AddStaff
          onAdded={() => {
            setAdding(false);
            reload();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {!data ? (
        <Loading error={error} onRetry={reload} />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone login</TableHead>
                <TableHead className="hidden md:table-cell">Last login</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u) => {
                const me = u.id === staff.id;
                return (
                  <TableRow key={u.id} className={u.is_active ? undefined : "opacity-60"}>
                    <TableCell className="py-3 pl-4">
                      <div className="font-medium">
                        {u.name} {me && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell className="text-sm" title={roleInfo[u.role]?.can}>
                      {roleInfo[u.role]?.label ?? u.role}
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.totp_enabled ? <span className="text-green-700 dark:text-green-400">Set up</span> : <span className="text-amber-700 dark:text-amber-400">Not set up yet</span>}
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell" title={formatDateTime(u.last_login_at)}>
                      {u.last_login_at ? timeAgo(u.last_login_at) : "Never"}
                    </TableCell>
                    <TableCell className="pr-4">
                      {!u.is_active ? (
                        <p className="text-right text-xs">Deactivated</p>
                      ) : me ? null : (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {!!u.totp_enabled && (
                            <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "reset", user: u })} title="Use this if they lost or changed their phone">
                              Reset phone login
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirm({ kind: "deactivate", user: u })}>
                            <X /> Deactivate
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <ConfirmDialog
        open={confirm?.kind === "reset"}
        onClose={() => setConfirm(null)}
        title={`Reset phone login for ${confirm?.user.name}?`}
        confirmLabel="Reset phone login"
        onConfirm={async () => {
          if (!confirm) return;
          await resetStaffTwoFactor(confirm.user.id);
          toast.success(`Phone login reset for ${confirm.user.name}`);
          reload();
        }}
      >
        <p>Use this when they lost or replaced their phone. They will be logged out, and the next time they log in they will scan a new QR code with their new phone.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm?.kind === "deactivate"}
        onClose={() => setConfirm(null)}
        title={`Deactivate ${confirm?.user.name}?`}
        tone="danger"
        confirmLabel="Deactivate account"
        onConfirm={async () => {
          if (!confirm) return;
          await deactivateStaff(confirm.user.id);
          toast.success(`${confirm.user.name} can no longer log in`);
          reload();
        }}
      >
        <p>They will be logged out straight away and can&apos;t log in again. Everything they did stays in the activity log.</p>
      </ConfirmDialog>
    </div>
  );
}
