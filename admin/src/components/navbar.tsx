"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BadgeCheck, CircleUser, Copy, FileText, History, LayoutDashboard, LifeBuoy, LogOut, Menu, UserCog, Users, X, type LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/_providers/themeToggle";
import { can, roleInfo, useStaff } from "@/components/auth-gate";
import { getSummary, logout, type Summary } from "@/lib/api";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; hint: string; Icon: LucideIcon; adminOnly?: boolean; count?: (s: Summary) => number; warn?: boolean };

const groups: { title: string; links: NavLink[] }[] = [
  {
    title: "Daily work",
    links: [
      { href: "/", label: "Home", hint: "What needs doing today", Icon: LayoutDashboard },
      { href: "/applications", label: "Applications", hint: "Review membership requests", Icon: FileText, count: (s) => s.applicationsOpen },
      { href: "/members", label: "Members", hint: "Find a member, issue a certificate", Icon: Users },
      { href: "/certificates", label: "Certificates", hint: "Download or cancel certificates", Icon: BadgeCheck, count: (s) => s.certificatesSuspiciousScans, warn: true },
      { href: "/duplicates", label: "Possible duplicates", hint: "Members that may be listed twice", Icon: Copy },
    ],
  },
  {
    title: "Administration",
    links: [
      { href: "/staff", label: "Staff accounts", hint: "Add or remove staff", Icon: UserCog, adminOnly: true },
      { href: "/audit-log", label: "Activity log", hint: "Who did what, and when", Icon: History, adminOnly: true },
    ],
  },
  {
    title: "You",
    links: [
      { href: "/account", label: "My account", hint: "Password and phone login", Icon: CircleUser },
      { href: "/help", label: "Help & guide", hint: "How things work", Icon: LifeBuoy },
    ],
  },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-lg bg-white p-1">
        <Image src="/logo.png" alt="" width={36} height={28} priority />
      </span>
      <span className="leading-tight">
        <span className="block font-semibold text-white">BSREA</span>
        <span className="block text-xs text-sidebar-foreground/70">Staff panel</span>
      </span>
    </Link>
  );
}

function SidebarContent({ summary, onNavigate }: { summary: Summary | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { staff, signedOut } = useStaff();
  const role = roleInfo[staff.role];

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      <div className="px-2">
        <Logo />
      </div>
      <nav className="flex-1 space-y-6" aria-label="Main">
        {groups.map((group) => {
          const links = group.links.filter((l) => !l.adminOnly || can(staff, "admin"));
          if (!links.length) return null;
          return (
            <div key={group.title}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">{group.title}</p>
              <ul className="space-y-0.5">
                {links.map(({ href, label, hint, Icon, count, warn }) => {
                  const active = isActive(pathname, href);
                  const n = summary && count ? count(summary) : 0;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                          active ? "bg-sidebar-accent text-white" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white",
                        )}
                      >
                        <Icon className={cn("size-5 shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/70 group-hover:text-white")} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{label}</span>
                          <span className="block truncate text-xs text-sidebar-foreground/60">{hint}</span>
                        </span>
                        {n > 0 && (
                          <span
                            className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", warn ? "bg-amber-400 text-amber-950" : "bg-sidebar-primary text-sidebar-primary-foreground")}
                            aria-label={warn ? `${n} need attention` : `${n} waiting`}
                          >
                            {n}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="rounded-xl bg-sidebar-accent/60 p-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            {staff.name
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase())
              .join("")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{staff.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/70" title={role.can}>
              {role.label}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              await logout().catch(() => null);
              signedOut();
            }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-sidebar-border bg-sidebar px-3 py-2 text-sm font-medium text-sidebar-foreground hover:text-white"
          >
            <LogOut className="size-4" /> Log out
          </button>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

/*--The page frame: a sidebar on computers, a top bar with a slide-in menu on phones--*/
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Refresh the counts next to the menu items whenever the page changes
  useEffect(() => {
    getSummary()
      .then(setSummary)
      .catch(() => null);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 bg-sidebar lg:block">
        <SidebarContent summary={summary} />
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-sidebar px-4 lg:hidden">
        <Logo />
        <button type="button" onClick={() => setMenuOpen(true)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white hover:bg-sidebar-accent" aria-label="Open menu" aria-expanded={menuOpen}>
          <Menu className="size-5" /> Menu
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-sidebar shadow-2xl">
            <button type="button" onClick={() => setMenuOpen(false)} className="absolute top-4 right-3 z-10 rounded-lg p-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white" aria-label="Close menu">
              <X className="size-5" />
            </button>
            <SidebarContent summary={summary} onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <main className="lg:pl-72">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
