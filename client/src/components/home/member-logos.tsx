"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Tab = { title: string; logos: { src: string; alt: string }[] };

/*--"Our Members": General / Associate tabs with a grid of company logos--*/
export default function MemberLogos({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);
  const tab = tabs[active];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Member types"
        className="mx-auto flex w-fit gap-1 rounded-full bg-brand-mist p-1"
      >
        {tabs.map((t, i) => (
          <button
            key={t.title}
            type="button"
            role="tab"
            id={`member-tab-${i}`}
            aria-selected={i === active}
            aria-controls="member-tab-panel"
            onClick={() => setActive(i)}
            className={cn(
              "rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-300",
              i === active
                ? "bg-white text-brand-green shadow-[var(--shadow-soft)]"
                : "text-brand-navy/60 hover:text-brand-navy",
            )}
          >
            {t.title}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="member-tab-panel"
        aria-labelledby={`member-tab-${active}`}
        key={active}
        className="mt-12 grid grid-cols-2 gap-3 animate-in fade-in duration-500 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
      >
        {tab.logos.map((logo) => (
          <div
            key={logo.src}
            className="group flex h-24 items-center justify-center rounded-2xl border border-brand-navy/5 bg-brand-snow p-4 transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-0.5 hover:bg-white hover:shadow-[var(--shadow-soft)]"
          >
            <Image
              src={logo.src}
              alt={logo.alt}
              width={300}
              height={150}
              className="max-h-full w-auto max-w-full object-contain opacity-70 grayscale transition-all duration-500 group-hover:opacity-100 group-hover:grayscale-0"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
