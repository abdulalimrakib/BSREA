"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, ShieldOff, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { roleInfo, useStaff } from "@/components/auth-gate";
import { Field, PageHeader } from "@/components/common";
import TwoFactorSetup from "@/components/two-factor-setup";
import { changePassword, disableTwoFactor } from "@/lib/api";

function TwoFactor() {
  const { staff, refresh } = useStaff();
  const [busy, setBusy] = useState(false);
  const onDisable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await disableTwoFactor(String(data.get("password")), String(data.get("code")));
      toast.success("Phone login is off");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not turn it off");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {staff.twoFactor ? <ShieldCheck className="size-5 text-primary" /> : <ShieldOff className="size-5 text-destructive" />}
          Phone login (two-factor)
          {staff.twoFactor ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-200">On</span>
          ) : (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-200">Off</span>
          )}
        </CardTitle>
        <CardDescription>Each time you log in, you also type a 6-digit number from an app on your phone. Then a stolen password alone isn&apos;t enough to get in.</CardDescription>
      </CardHeader>
      <CardContent>
        {!staff.twoFactor ? (
          <TwoFactorSetup
            onDone={() => {
              toast.success("Phone login is on. You were logged out everywhere else.");
              refresh();
            }}
          />
        ) : staff.twoFactorRequired ? (
          <p className="text-sm text-muted-foreground">It is required for all staff, so it can&apos;t be turned off. Lost or changed your phone? Ask an administrator to reset it, then set it up again.</p>
        ) : (
          <form onSubmit={onDisable} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Your password" htmlFor="tf-password">
              <Input id="tf-password" name="password" type="password" autoComplete="current-password" required />
            </Field>
            <Field label="Code from the app" htmlFor="tf-code">
              <Input id="tf-code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required />
            </Field>
            <Button type="submit" variant="outline" disabled={busy}>
              Turn off
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function ChangePassword() {
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const mismatch = repeat.length > 0 && next !== repeat;
  const rules = [
    { ok: next.length >= 12, text: "At least 12 characters" },
    { ok: /[A-Z]/.test(next) && /[a-z]/.test(next), text: "Capital and small letters" },
    { ok: /\d/.test(next), text: "At least one number" },
  ];
  const strong = rules.every((r) => r.ok);
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (next !== repeat) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      await changePassword(String(data.get("current")), next);
      toast.success("Password changed. You were logged out everywhere else.");
      form.reset();
      setNext("");
      setRepeat("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-muted-foreground" /> Change my password
        </CardTitle>
        <CardDescription>A short sentence you can remember works well, for example “Green sun over Dhaka 2026”.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid max-w-xl gap-4">
          <Field label="Current password" htmlFor="pw-current">
            <Input id="pw-current" name="current" type="password" autoComplete="current-password" required />
          </Field>
          <Field
            label="New password"
            htmlFor="pw-next"
            hint={
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                {rules.map((r) => (
                  <span key={r.text} className={r.ok ? "text-green-700 dark:text-green-400" : undefined}>
                    {r.ok ? "✓" : "○"} {r.text}
                  </span>
                ))}
              </span>
            }
          >
            <Input id="pw-next" type="password" autoComplete="new-password" required minLength={12} value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="Type the new password again" htmlFor="pw-repeat" hint={mismatch ? <span className="text-destructive">The two new passwords are different</span> : undefined}>
            <Input id="pw-repeat" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} aria-invalid={mismatch} />
          </Field>
          <div>
            <Button type="submit" disabled={busy || mismatch || !strong || !repeat}>
              {busy ? "Saving…" : "Change password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AccountPage() {
  const { staff } = useStaff();
  const role = roleInfo[staff.role];
  return (
    <div className="space-y-6">
      <PageHeader title="My account" description="Your details, your password and your phone login." />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
            <UserRound className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{staff.name}</p>
            <p className="text-sm text-muted-foreground">{staff.email}</p>
          </div>
          <div className="w-full rounded-lg bg-muted p-3 text-sm sm:w-auto sm:max-w-sm">
            <p className="font-medium">Your role: {role.label}</p>
            <p className="text-muted-foreground">{role.can}</p>
          </div>
        </CardContent>
      </Card>
      <TwoFactor />
      <ChangePassword />
    </div>
  );
}
