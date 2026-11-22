"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import { Eye, EyeOff, Smartphone } from "lucide-react";
import { ApiError, getMe, login, logout, type Role, type Staff } from "@/lib/api";
import TwoFactorSetup from "@/components/two-factor-setup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/*--Shows the login form until a staff member is logged in, then the page.
  The session itself lives in an httpOnly cookie that scripts can't read; this only asks the API "who am I?".--*/

type StaffContextValue = {
  staff: Staff;
  refresh: () => void;
  signedOut: () => void;
};
const StaffContext = createContext<StaffContextValue | null>(null);

export const useStaff = () => {
  const value = useContext(StaffContext);
  if (!value) throw new Error("useStaff must be used inside <AuthGate>");
  return value;
};

/*--What each role is called and allowed to do, in plain words--*/
export const roleInfo: Record<Role, { label: string; can: string }> = {
  staff: { label: "Reviewer", can: "Can open and check applications, and confirm possible duplicates." },
  approver: { label: "Approver", can: "Everything a reviewer can do, plus approve or reject applications, issue or cancel certificates, and see full ID numbers." },
  admin: { label: "Administrator", can: "Everything an approver can do, plus add or remove staff and read the activity log." },
};

/*--Can this role do it?--*/
export const can = (staff: Staff, action: "approve" | "admin") =>
  action === "admin"
    ? staff.role === "admin"
    : staff.role === "admin" || staff.role === "approver";

function LoginForm({ onLoggedIn }: { onLoggedIn: (staff: Staff) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // After a right password, accounts with two-factor login also need the code from the app
  const [needCode, setNeedCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      onLoggedIn(
        await login(
          String(data.get("email")),
          String(data.get("password")),
          needCode ? String(data.get("code")) : undefined,
        ),
      );
    } catch (e) {
      const codeAsked =
        e instanceof ApiError &&
        (e.data as { twoFactorRequired?: boolean } | null)
          ?.twoFactorRequired === true;
      if (codeAsked && !needCode) setNeedCode(true);
      else setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Centered>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <Image src="/logo.png" alt="BSREA" width={116} height={90} className="mx-auto" priority />
          <CardTitle className="mt-2 text-xl">Staff sign in</CardTitle>
          <p className="text-sm text-muted-foreground">
            {needCode ? "One more step: open the authenticator app on your phone." : "Use the email and password your administrator gave you."}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {needCode && (
              <div className="space-y-1.5 rounded-lg border border-primary/30 bg-accent/50 p-3">
                <p className="flex items-center gap-2 text-sm">
                  <Smartphone className="size-4 text-primary" /> Type the 6-digit number the app shows for BSREA.
                </p>
                <label htmlFor="code" className="text-sm font-medium">
                  Code from your authenticator app
                </label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9 ]{6,7}"
                  placeholder="123456"
                  required
                  autoFocus
                  className="h-11 text-center font-mono text-lg tracking-[0.4em]"
                />
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">Forgot your password or lost your phone? Ask an administrator to help you.</p>
          </form>
        </CardContent>
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-accent via-background to-background p-4">{children}</div>;
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null | undefined>(undefined);
  const [backendDown, setBackendDown] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getMe()
      .then((me) => {
        setStaff(me);
        setBackendDown(null);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.statusCode === 0)
          setBackendDown(e.message);
        setStaff(null);
      });
  }, []);

  useEffect(refresh, [refresh]);

  if (backendDown)
    return (
      <Centered>
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-4">
            <p className="font-medium">The staff panel can&apos;t reach the server</p>
            <p className="text-sm text-muted-foreground">{backendDown}</p>
            <Button variant="outline" onClick={refresh}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </Centered>
    );
  if (staff === undefined)
    return (
      <Centered>
        <p className="text-muted-foreground">Loading…</p>
      </Centered>
    );
  if (!staff) return <LoginForm onLoggedIn={setStaff} />;
  if (staff.twoFactorRequired && !staff.twoFactor) {
    return (
      <Centered>
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle>Set up two-factor login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              Staff accounts can see applicants&apos; personal data, so each
              login needs a code from your phone as well as your password.
            </p>
            <TwoFactorSetup onDone={refresh} />
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => (
                await logout().catch(() => null),
                setStaff(null)
              )}
            >
              Log out
            </Button>
          </CardContent>
        </Card>
      </Centered>
    );
  }
  return (
    <StaffContext.Provider
      value={{ staff, refresh, signedOut: () => setStaff(null) }}
    >
      {children}
    </StaffContext.Provider>
  );
}
