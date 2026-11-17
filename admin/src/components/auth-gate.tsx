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
import { ShieldCheck } from "lucide-react";
import { ApiError, getMe, login, logout, type Staff } from "@/lib/api";
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
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <ShieldCheck className="mx-auto size-10 text-primary" />
          <CardTitle>BSREA Staff Login</CardTitle>
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
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {needCode && (
              <div className="space-y-1.5">
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
                />
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
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
    return <p className="py-20 text-center text-destructive">{backendDown}</p>;
  if (staff === undefined)
    return <p className="py-20 text-center text-muted-foreground">Loading…</p>;
  if (!staff) return <LoginForm onLoggedIn={setStaff} />;
  if (staff.twoFactorRequired && !staff.twoFactor) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Card className="w-full max-w-md">
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
      </div>
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
