"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { can, useStaff } from "@/components/auth-gate";
import { formatDateTime, Loading, useApi } from "@/components/common";
import TwoFactorSetup from "@/components/two-factor-setup";
import {
  changePassword,
  createStaff,
  deactivateStaff,
  disableTwoFactor,
  getStaff,
  resetStaffTwoFactor,
  type Role,
} from "@/lib/api";

function TwoFactor() {
  const { staff, refresh } = useStaff();
  const [busy, setBusy] = useState(false);
  const onDisable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await disableTwoFactor(
        String(data.get("password")),
        String(data.get("code")),
      );
      toast.success("Two-factor login is off");
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
        <CardTitle>
          Two-factor login{" "}
          {staff.twoFactor ? (
            <span className="ml-2 text-sm font-normal text-green-700">On</span>
          ) : (
            <span className="ml-2 text-sm font-normal text-destructive">
              Off
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!staff.twoFactor ? (
          <TwoFactorSetup
            onDone={() => {
              toast.success(
                "Two-factor login is on. Other sessions were logged out.",
              );
              refresh();
            }}
          />
        ) : staff.twoFactorRequired ? (
          <p className="text-sm text-muted-foreground">
            Each login asks for a code from your authenticator app. It is
            required for all staff. Lost your phone? Ask an admin to reset it.
          </p>
        ) : (
          <form onSubmit={onDisable} className="flex flex-wrap items-end gap-3">
            <Input
              name="password"
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              required
              className="max-w-[200px]"
              aria-label="Password"
            />
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Code"
              required
              className="max-w-[120px]"
              aria-label="Code"
            />
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
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      await changePassword(
        String(data.get("current")),
        String(data.get("next")),
      );
      toast.success("Password changed. Other sessions were logged out.");
      form.reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change my password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <Input
            name="current"
            type="password"
            placeholder="Current password"
            autoComplete="current-password"
            required
            className="max-w-[220px]"
          />
          <Input
            name="next"
            type="password"
            placeholder="New password (12+ characters)"
            autoComplete="new-password"
            required
            className="max-w-[260px]"
          />
          <Button type="submit" disabled={busy}>
            Change
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function StaffPage() {
  const { staff } = useStaff();
  const isAdmin = can(staff, "admin");
  const { data, error, reload } = useApi(
    () => (isAdmin ? getStaff() : Promise.resolve([])),
    [isAdmin],
  );
  const [role, setRole] = useState<Role>("staff");

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const d = new FormData(form);
    try {
      await createStaff({
        email: String(d.get("email")),
        name: String(d.get("name")),
        role,
        password: String(d.get("password")),
      });
      toast.success("Account created");
      form.reset();
      reload();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not create the account",
      );
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Staff accounts</h1>
      <TwoFactor />
      <ChangePassword />
      {isAdmin &&
        (!data ? (
          <Loading error={error} />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Add a staff account</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={onCreate}
                  className="flex flex-wrap items-end gap-3"
                >
                  <Input
                    name="name"
                    placeholder="Name"
                    required
                    className="max-w-[200px]"
                  />
                  <Input
                    name="email"
                    type="email"
                    placeholder="Email"
                    required
                    className="max-w-[240px]"
                  />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  >
                    <option value="staff">Staff (review)</option>
                    <option value="approver">Approver</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Input
                    name="password"
                    type="password"
                    placeholder="Temporary password"
                    autoComplete="new-password"
                    required
                    className="max-w-[220px]"
                  />
                  <Button type="submit">Add</Button>
                </form>
              </CardContent>
            </Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Two-factor</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((u) => (
                  <TableRow
                    key={u.id}
                    className={u.is_active ? undefined : "opacity-50"}
                  >
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell className="capitalize">{u.role}</TableCell>
                    <TableCell className="text-xs">
                      {u.totp_enabled ? (
                        "On"
                      ) : (
                        <span className="text-destructive">Off</span>
                      )}
                      {u.totp_enabled && u.id !== staff.id ? (
                        <Button
                          size="sm"
                          variant="link"
                          className="ml-1 h-auto p-0 text-xs"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Reset two-factor login for ${u.name}? Use this if they lost their phone. They will be logged out and set it up again at their next login.`,
                              )
                            )
                              return;
                            try {
                              await resetStaffTwoFactor(u.id);
                              toast.success("Reset");
                              reload();
                            } catch (e) {
                              toast.error(
                                e instanceof Error
                                  ? e.message
                                  : "Could not reset",
                              );
                            }
                          }}
                        >
                          (reset)
                        </Button>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDateTime(u.last_login_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {u.is_active && u.id !== staff.id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Deactivate ${u.name}? They will be logged out.`,
                              )
                            )
                              return;
                            try {
                              await deactivateStaff(u.id);
                              reload();
                            } catch (e) {
                              toast.error(
                                e instanceof Error
                                  ? e.message
                                  : "Could not deactivate",
                              );
                            }
                          }}
                        >
                          Deactivate
                        </Button>
                      ) : !u.is_active ? (
                        <span className="text-xs">Deactivated</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ))}
    </div>
  );
}
