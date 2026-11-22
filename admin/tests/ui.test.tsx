import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AuthGate from "@/components/auth-gate";
import AppShell from "@/components/navbar";
import { ConfirmDialog } from "@/components/common";
import { describeAction } from "@/lib/audit-labels";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("describes activity-log codes in plain words, and flags the worrying ones", () => {
  expect(describeAction("login.locked_now")).toMatchObject({ text: "Account locked after too many failed logins", tone: "danger", category: "login" });
  expect(describeAction("application.approved")).toMatchObject({ text: "Approved an application", tone: "normal" });
  // An action the panel doesn't know yet is still readable
  expect(describeAction("certificate.something_new")).toMatchObject({ text: "Certificate something new", category: "certificate" });
});

it("keeps the confirm button off until a long enough reason is typed", async () => {
  const onConfirm = vi.fn();
  render(
    <ConfirmDialog open onClose={() => {}} title="Reject?" confirmLabel="Reject application" reason={{ label: "Reason", minLength: 5 }} onConfirm={onConfirm}>
      <p>Sure?</p>
    </ConfirmDialog>,
  );
  const button = screen.getByRole("button", { name: "Reject application", hidden: true }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "  Expired licence " } });
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("Expired licence"));
});

it("gives every role a way to their own account settings, and hides admin pages from reviewers", async () => {
  const me = { id: 2, email: "r@b.bd", name: "Rahim Uddin", role: "staff", twoFactor: true, twoFactorRequired: true };
  const summary = { applicationsOpen: 3, applicationsFlagged: 1, members: 10, certificatesValid: 8, certificatesSuspiciousScans: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const data = String(url).endsWith("/auth/me") ? me : summary;
      return new Response(JSON.stringify({ success: true, message: "OK", statusCode: 200, data }), { status: 200 });
    }),
  );
  render(
    <AuthGate>
      <AppShell>
        <p>page</p>
      </AppShell>
    </AuthGate>,
  );
  expect((await screen.findAllByRole("link", { name: /My account/ })).length).toBeGreaterThan(0);
  expect(screen.queryByRole("link", { name: /Staff accounts/ })).toBeNull();
  expect(screen.queryByRole("link", { name: /Activity log/ })).toBeNull();
  // The number of waiting applications shows next to the menu item
  expect(await screen.findByLabelText("3 waiting")).toBeTruthy();
});
