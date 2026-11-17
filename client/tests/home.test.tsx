import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Home from "@/app/page";

// next/image needs the Next.js server; a plain <img> is enough for these tests
vi.mock("next/image", () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  default: ({ fill, priority, ...props }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...(props as object)} alt={String(props.alt ?? "")} />
  ),
}));

afterEach(cleanup);

it("shows the home page sections", () => {
  render(<Home />);
  expect(
    screen.getByRole("heading", {
      level: 1,
      name: /Empowering Bangladesh’s clean energy future/i,
    }),
  ).toBeTruthy();
  for (const name of [
    "Latest News & Events",
    "BSREA in action",
    "Trusted by the industry",
    "Become a Member",
  ]) {
    expect(screen.getByRole("heading", { name })).toBeTruthy();
  }
  // Section labels above the headings
  for (const label of [
    "Mission & Vision",
    "Message from the President",
    "Message from the Secretary",
    "Our Commitment",
    "What We Do",
    "Our Members",
  ]) {
    expect(screen.getByText(label)).toBeTruthy();
  }
  expect(
    screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
  ).toEqual(expect.arrayContaining(["Mission", "Vision"]));
});

it("lists the six newest posts, each card a link to its post", () => {
  render(<Home />);
  const news = screen
    .getByRole("heading", { name: "Latest News & Events" })
    .closest("section")!;
  const titles = news.querySelectorAll("article h3 a");
  expect(titles).toHaveLength(6);
  titles.forEach((a) =>
    expect(a.getAttribute("href")).toMatch(/^\/[a-z0-9-]+$/),
  );
});
