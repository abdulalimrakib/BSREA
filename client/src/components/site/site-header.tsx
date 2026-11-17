"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { mainMenu, site, socials, type NavItem } from "@/lib/site";
import SocialIcon from "@/components/site/social-icon";
import { cn } from "@/lib/utils";

/*--Is this menu item (or one of its children) the page we are on?--*/
const isActive = (item: NavItem, pathname: string) => {
  const match = (href?: string) =>
    !!href &&
    (href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`));
  return (
    match(item.href) || !!item.children?.some((child) => match(child.href))
  );
};

export default function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // Desktop drop-down that was just used: kept closed until the mouse leaves it
  const [closedMenu, setClosedMenu] = useState<string | null>(null);

  // After choosing a page from a drop-down, close it (it opens on hover and on focus, and both would otherwise keep it open)
  const closeMenu = (label: string) => {
    setClosedMenu(label);
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  };
  const [scrolled, setScrolled] = useState(false);

  // Close the mobile menu after navigating
  useEffect(() => {
    setMobileOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  // The page behind the open mobile menu shouldn't scroll
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // A slimmer, frosted header once the page is scrolled
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-500 ease-[var(--ease-smooth)]",
        scrolled || mobileOpen
          ? "border-brand-navy/5 bg-white/85 shadow-[0_8px_32px_-16px_rgb(25_42_61/0.18)] backdrop-blur-xl backdrop-saturate-150"
          : "border-transparent bg-white",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-5 transition-[height] duration-500 ease-[var(--ease-smooth)] sm:px-6",
          scrolled ? "h-[68px]" : "h-[76px] md:h-[92px]",
        )}
      >
        <Link href="/" className="shrink-0" aria-label={site.title}>
          <Image
            src={site.logo}
            alt={site.title}
            width={464}
            height={360}
            priority
            className={cn(
              "w-auto transition-[height] duration-500 ease-[var(--ease-smooth)]",
              scrolled ? "h-[48px]" : "h-[56px] md:h-[70px]",
            )}
          />
        </Link>

        <nav aria-label="Main Menu" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {mainMenu.map((item) => {
              const active = isActive(item, pathname);
              const linkClass = cn(
                "relative flex items-center gap-1 rounded-full px-3.5 py-2 text-[14px] font-medium text-brand-navy/80 transition-colors duration-200 hover:bg-brand-navy/[0.04] hover:text-brand-navy xl:px-4",
                active && "text-brand-green hover:text-brand-green",
              );
              return (
                <li
                  key={item.label}
                  className="group relative"
                  onMouseLeave={() => setClosedMenu(null)}
                >
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={linkClass}
                      aria-current={active ? "page" : undefined}
                      onClick={() => item.children && closeMenu(item.label)}
                    >
                      {item.label}
                      {item.children && (
                        <ChevronDown className="size-3.5 opacity-60 transition-transform duration-300 group-hover:rotate-180" />
                      )}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={linkClass}
                      aria-haspopup="true"
                    >
                      {item.label}
                      <ChevronDown className="size-3.5 opacity-60 transition-transform duration-300 group-hover:rotate-180" />
                    </button>
                  )}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-brand-green"
                    />
                  )}
                  {item.children && (
                    <div
                      className={cn(
                        "invisible absolute top-full left-1/2 -translate-x-1/2 translate-y-2 pt-3 opacity-0 transition-all duration-300 ease-[var(--ease-smooth)]",
                        closedMenu !== item.label &&
                          "group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100",
                      )}
                    >
                      <ul className="min-w-[250px] rounded-2xl border border-brand-navy/5 bg-white p-2 shadow-[var(--shadow-lift)]">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={() => closeMenu(item.label)}
                              className={cn(
                                "block rounded-xl px-4 py-2.5 text-[14px] text-brand-slate transition-colors hover:bg-brand-mint hover:text-brand-green",
                                pathname === child.href &&
                                  "bg-brand-mint/60 font-medium text-brand-green",
                              )}
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/eligibility-membership-form"
            className="hidden rounded-full bg-brand-green px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgb(9_120_52/0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0a8a3c] sm:inline-flex"
          >
            Become a Member
          </Link>
          <button
            type="button"
            className="rounded-full p-2.5 text-brand-navy transition-colors hover:bg-brand-navy/5 lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? (
              <X className="size-6" />
            ) : (
              <Menu className="size-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav
          aria-label="Mobile Menu"
          className="absolute inset-x-0 top-full h-[calc(100dvh-100%)] overflow-y-auto overscroll-contain border-t border-brand-navy/5 bg-white animate-in fade-in slide-in-from-top-2 duration-300 lg:hidden"
        >
          <ul className="px-5 py-3">
            {mainMenu.map((item) => (
              <li
                key={item.label}
                className="border-b border-brand-navy/5 last:border-0"
              >
                <div className="flex items-center justify-between">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="flex-1 py-3.5 text-[15px] font-medium text-brand-navy"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="flex-1 py-3.5 text-left text-[15px] font-medium text-brand-navy"
                      onClick={() =>
                        setOpenGroup(
                          openGroup === item.label ? null : item.label,
                        )
                      }
                    >
                      {item.label}
                    </button>
                  )}
                  {item.children && (
                    <button
                      type="button"
                      aria-label={`Show ${item.label} pages`}
                      aria-expanded={openGroup === item.label}
                      className="rounded-full p-3 text-brand-navy/60"
                      onClick={() =>
                        setOpenGroup(
                          openGroup === item.label ? null : item.label,
                        )
                      }
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform duration-300",
                          openGroup === item.label && "rotate-180",
                        )}
                      />
                    </button>
                  )}
                </div>
                {item.children && openGroup === item.label && (
                  <ul className="pb-3 pl-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className="block rounded-lg px-3 py-2 text-sm text-brand-slate hover:bg-brand-mint hover:text-brand-green"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-4 px-5 pb-6">
            <Link
              href="/eligibility-membership-form"
              className="rounded-full bg-brand-green px-5 py-2.5 text-sm font-semibold text-white sm:hidden"
            >
              Become a Member
            </Link>
            <div className="flex gap-2">
              {socials.map((s) => (
                <a
                  key={s.network}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="rounded-full p-2.5 text-brand-navy/60 transition-colors hover:bg-brand-mint hover:text-brand-green"
                >
                  <SocialIcon network={s.network} className="size-4" />
                </a>
              ))}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
