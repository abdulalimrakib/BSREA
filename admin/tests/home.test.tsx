import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AuthGate from "@/components/auth-gate";
import { DuplicateList } from "@/components/common";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("asks for a login when there is no session", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            message: "Please log in",
            statusCode: 401,
          }),
          { status: 401 },
        ),
    ),
  );
  render(
    <AuthGate>
      <p>secret page</p>
    </AuthGate>,
  );
  expect(await screen.findByRole("button", { name: "Log in" })).toBeTruthy();
  expect(screen.queryByText("secret page")).toBeNull();
});

it("marks exact duplicates as blocking and others as needing a check", () => {
  render(
    <DuplicateList
      matches={[
        {
          level: "block",
          field: "trade_license",
          match: "exact",
          against: "member",
          id: 1,
          label: "Bengal Renewable Energy Limited (BSREA-M-0000-0004)",
        },
        {
          level: "review",
          field: "company",
          match: "similar",
          against: "application",
          id: 2,
          label: "Sunrise Power (application APP-1)",
          score: 0.91,
        },
      ]}
    />,
  );
  expect(screen.getByText(/Blocks approval/)).toBeTruthy();
  expect(screen.getByText(/is similar \(91%\) to/)).toBeTruthy();
});

it("asks for the authenticator code after a right password when two-factor login is on", async () => {
  const { fireEvent } = await import("@testing-library/react");
  const answers = [
    {
      status: 401,
      body: { success: false, message: "Please log in", statusCode: 401 },
    }, // /me
    {
      status: 401,
      body: {
        success: false,
        message: "Enter the 6-digit code from your authenticator app",
        statusCode: 401,
        data: { twoFactorRequired: true },
      },
    },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const a = answers.shift()!;
      return new Response(JSON.stringify(a.body), { status: a.status });
    }),
  );
  render(
    <AuthGate>
      <p>secret page</p>
    </AuthGate>,
  );
  fireEvent.change(await screen.findByLabelText("Email"), {
    target: { value: "a@b.bd" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "pw" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
  expect(
    await screen.findByLabelText("Code from your authenticator app"),
  ).toBeTruthy();
  expect(screen.queryByText("secret page")).toBeNull();
});

it("shows only the two-factor set-up until it is done, when it is required", async () => {
  const me = {
    id: 1,
    email: "a@b.bd",
    name: "A",
    role: "staff",
    twoFactor: false,
    twoFactorRequired: true,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            message: "OK",
            statusCode: 200,
            data: me,
          }),
          { status: 200 },
        ),
    ),
  );
  render(
    <AuthGate>
      <p>secret page</p>
    </AuthGate>,
  );
  expect(await screen.findByText("Set up two-factor login")).toBeTruthy();
  expect(screen.queryByText("secret page")).toBeNull();
});
