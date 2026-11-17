"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/site/blocks";
import { cn } from "@/lib/utils";

const slides = [
  "/uploads/2026/02/pexels-nadialovessingle-21582562-scaled.jpg",
  "/uploads/2025/04/renewable-energy-generation.jpg",
  "/uploads/2026/02/pexels-kelly-4320475-scaled.jpg",
];

/*--Home page hero: slowly zooming photos that cross-fade, under a navy gradient, with the headline and two actions--*/
export default function HeroSlideshow() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (
      paused ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = setInterval(
      () => setCurrent((i) => (i + 1) % slides.length),
      6500,
    );
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <section className="relative isolate flex min-h-[600px] items-center overflow-hidden bg-brand-navy md:min-h-[calc(100svh-92px)]">
      {slides.map((src, i) => (
        <div
          key={src}
          aria-hidden="true"
          className={cn(
            "absolute inset-0 -z-20 transition-opacity duration-[1600ms] ease-[var(--ease-smooth)]",
            i === current ? "opacity-100" : "opacity-0",
          )}
        >
          <Image
            src={src}
            alt=""
            fill
            priority={i === 0}
            sizes="100vw"
            // Re-mounting the image restarts the slow zoom each time its slide comes back
            key={i === current ? `on-${current}` : "off"}
            className="object-cover motion-safe:animate-[ken-burns_9s_linear_both]"
          />
        </div>
      ))}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-navy/95 via-brand-navy/70 to-brand-navy/20"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-brand-navy/60 to-transparent"
      />

      <div className="mx-auto w-full max-w-[1200px] px-5 py-24 sm:px-6">
        <div className="max-w-[760px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-1000">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wide text-white/90 backdrop-blur-md">
            <span
              className="size-1.5 rounded-full bg-brand-yellow"
              aria-hidden="true"
            />
            Advocating for renewable energy since 2011
          </p>
          <h1 className="mt-7 text-[44px] leading-[1.05] text-white sm:text-6xl md:text-[76px]">
            Empowering Bangladesh’s{" "}
            <em className="text-brand-yellow">clean energy</em> future
          </h1>
          <p className="mt-6 max-w-[560px] text-lg leading-relaxed font-light text-white/80 md:text-xl">
            For all of us. The unified voice of more than 200 solar, wind, hydro
            and energy-efficiency companies across Bangladesh.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/eligibility-membership-form">
              Become a Member
            </ButtonLink>
            <ButtonLink href="/about-bsrea" variant="light">
              About BSREA
            </ButtonLink>
          </div>
        </div>
      </div>

      {/* Slide dots */}
      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 md:left-auto md:right-10 md:translate-x-0">
        {slides.map((src, i) => (
          <button
            key={src}
            type="button"
            aria-label={`Show photo ${i + 1}`}
            aria-current={i === current}
            onClick={() => {
              setCurrent(i);
              setPaused(true);
            }}
            className={cn(
              "h-1.5 rounded-full transition-all duration-500 ease-[var(--ease-smooth)]",
              i === current
                ? "w-8 bg-brand-yellow"
                : "w-1.5 bg-white/40 hover:bg-white/70",
            )}
          />
        ))}
      </div>
      <span
        aria-hidden="true"
        className="absolute bottom-8 left-10 hidden h-10 w-6 rounded-full border border-white/30 md:block"
      >
        <span className="absolute top-2 left-1/2 h-2 w-0.5 -translate-x-1/2 rounded-full bg-white motion-safe:animate-[scroll-hint_2s_ease-in-out_infinite]" />
      </span>
    </section>
  );
}
