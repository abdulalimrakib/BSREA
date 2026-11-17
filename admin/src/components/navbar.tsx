"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/_providers/themeToggle";
import { can, useStaff } from "@/components/auth-gate";
import { logout } from "@/lib/api";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/applications", label: "Applications" },
  { href: "/members", label: "Members" },
  { href: "/duplicates", label: "Duplicates" },
  { href: "/certificates", label: "Certificates" },
  { href: "/staff", label: "Staff", adminOnly: true },
  { href: "/audit-log", label: "Audit log", adminOnly: true },
];

export default function Navbar() {
  const pathname = usePathname();
  const { staff, signedOut } = useStaff();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <nav className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
        <Link href="/" className="font-semibold">
          BSREA Admin
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          {links
            .filter((l) => !l.adminOnly || can(staff, "admin"))
            .map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  (href === "/" ? pathname === "/" : pathname.startsWith(href)) && "bg-accent text-foreground"
                )}
              >
                {label}
              </Link>
            ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {staff.name} · <span className="capitalize">{staff.role}</span>
          </span>
          <button
            type="button"
            onClick={async () => {
              await logout().catch(() => null);
              signedOut();
            }}
            className="rounded-md p-2 text-muted-foreground hover:text-foreground"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="size-4" />
          </button>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
