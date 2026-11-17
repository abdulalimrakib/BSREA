"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setupTwoFactor, enableTwoFactor } from "@/lib/api";

/*--Turn on two-factor login: confirm the password, scan the QR code, type the first code--*/
export default function TwoFactorSetup({ onDone }: { onDone: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run =
    (work: (data: FormData) => Promise<void>) =>
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      setBusy(true);
      setError(null);
      try {
        await work(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    };

  if (!setup) {
    return (
      <form
        onSubmit={run(async (d) =>
          setSetup(await setupTwoFactor(String(d.get("password")))),
        )}
        className="space-y-3"
      >
        <p className="text-sm text-muted-foreground">
          You will need an authenticator app on your phone, such as Google
          Authenticator, Microsoft Authenticator or Authy. Confirm your password
          to start.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            name="password"
            type="password"
            placeholder="Your password"
            autoComplete="current-password"
            required
            className="max-w-[240px]"
            aria-label="Your password"
          />
          <Button type="submit" disabled={busy}>
            Start
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <form
      onSubmit={run(
        async (d) => (await enableTwoFactor(String(d.get("code"))), onDone()),
      )}
      className="space-y-4"
    >
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>
          Open the authenticator app and add an account by scanning this QR
          code.
        </li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated QR code (data: URL) */}
      <img
        src={setup.qr}
        alt="QR code for the authenticator app"
        width={220}
        height={220}
        className="rounded-md border bg-white p-2"
      />
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Can&apos;t scan? Type this key instead
        </summary>
        <code className="mt-2 block break-all rounded bg-muted p-2 font-mono text-xs">
          {setup.secret.match(/.{1,4}/g)?.join(" ")}
        </code>
      </details>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          placeholder="123456"
          required
          className="max-w-[140px]"
          aria-label="6-digit code"
        />
        <Button type="submit" disabled={busy}>
          Turn on
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
