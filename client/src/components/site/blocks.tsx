/*--Building blocks shared by the pages--*/

import Image from "next/image";
import Link from "next/link";
import type React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*--Page width container--*/
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1200px] px-5 sm:px-6", className)}
    >
      {children}
    </div>
  );
}

/*--A small label above a heading: a short yellow line and spaced capitals--*/
export function Eyebrow({
  children,
  className,
  light,
}: {
  children: React.ReactNode;
  className?: string;
  light?: boolean;
}) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-3 text-xs font-semibold tracking-[0.2em] uppercase",
        light ? "text-brand-yellow" : "text-brand-green",
        className,
      )}
    >
      <span aria-hidden="true" className="h-px w-8 bg-current" />
      {children}
    </p>
  );
}

/*--The photo banner at the top of inner pages: the photo under a soft navy gradient, title in white--*/
export function PageBanner({
  title,
  image,
  position = "center",
}: {
  title: string;
  image: string;
  variant?: "serif" | "yellow";
  position?: string;
}) {
  return (
    <section className="relative isolate flex h-[300px] items-end overflow-hidden bg-brand-navy md:h-[400px]">
      <Image
        src={image}
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover motion-safe:animate-[ken-burns_14s_var(--ease-smooth)_both]"
        style={{ objectPosition: position }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-navy via-brand-navy/55 to-brand-navy/10"
      />
      <Container className="pb-10 md:pb-14">
        <Eyebrow light>BSREA</Eyebrow>
        <h1 className="mt-3 max-w-3xl text-4xl leading-[1.1] text-white motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 md:text-[56px]">
          {title}
        </h1>
      </Container>
    </section>
  );
}

/*--A short yellow line under headings--*/
export function Divider({
  className,
  center,
}: {
  className?: string;
  center?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block h-[3px] w-12 rounded-full bg-gradient-to-r from-brand-yellow to-brand-yellow/30",
        center && "mx-auto",
        className,
      )}
    />
  );
}

/*--A section heading with the yellow divider underneath--*/
export function SectionTitle({
  children,
  eyebrow,
  center,
  className,
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  eyebrow?: string;
  center?: boolean;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn(center && "text-center", className)}>
      {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
      <Tag className="text-3xl leading-tight md:text-[44px]">{children}</Tag>
    </div>
  );
}

/*--HTML that came from WordPress--*/
export function RichText({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={cn("rich-text", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/*--Yellow (or green) button link--*/
export function ButtonLink({
  href,
  children,
  variant = "yellow",
  className,
  external,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "yellow" | "green" | "outline" | "light";
  className?: string;
  external?: boolean;
}) {
  const classes = cn(
    "group/btn inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold tracking-wide transition-all duration-300 ease-[var(--ease-smooth)] hover:-translate-y-0.5 active:translate-y-0",
    variant === "yellow" &&
      "bg-brand-yellow text-brand-navy shadow-[0_8px_24px_-8px_rgb(251_193_23/0.7)] hover:bg-[#ffcd3c] hover:shadow-[0_12px_32px_-8px_rgb(251_193_23/0.8)]",
    variant === "green" &&
      "bg-brand-green text-white shadow-[0_8px_24px_-8px_rgb(9_120_52/0.6)] hover:bg-[#0a8a3c] hover:shadow-[0_12px_32px_-8px_rgb(9_120_52/0.7)]",
    variant === "outline" &&
      "border border-brand-navy/20 text-brand-navy hover:border-brand-green hover:text-brand-green",
    variant === "light" &&
      "border border-white/30 text-white backdrop-blur-sm hover:border-white hover:bg-white/10",
    className,
  );
  children = (
    <>
      {children}
      <ArrowRight
        aria-hidden="true"
        className="size-4 transition-transform duration-300 group-hover/btn:translate-x-1"
      />
    </>
  );
  if (
    external ||
    /^(https?:|mailto:|tel:)/.test(href) ||
    /\.(pdf|docx?)$/i.test(href)
  ) {
    return (
      <a
        href={href}
        className={classes}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

/*--"Take action today" call to action used at the bottom of most pages--*/
export function JoinCta({
  title = "Take action today—together, we can power a sustainable future",
  text = "Join the Bangladesh Sustainable and Renewable Energy Association (BSREA) and be part of the renewable energy movement in Bangladesh.",
  href = "/eligibility-membership-form",
  button = "Become a Member",
}: {
  title?: string;
  text?: string;
  href?: string;
  button?: string;
}) {
  return (
    <section className="py-16 md:py-24">
      <Container>
        <div className="reveal relative isolate overflow-hidden rounded-[2rem] bg-brand-navy px-6 py-16 text-center md:px-16 md:py-20">
          <div
            aria-hidden="true"
            className="absolute -top-32 -left-24 -z-10 size-96 rounded-full bg-brand-green/40 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -right-24 -bottom-32 -z-10 size-96 rounded-full bg-brand-yellow/20 blur-3xl"
          />
          <Eyebrow light>Join BSREA</Eyebrow>
          <h2 className="mx-auto mt-5 max-w-[760px] text-3xl leading-tight text-white md:text-5xl">
            {title}
          </h2>
          <p className="mx-auto mt-5 max-w-[620px] text-lg leading-relaxed font-light text-white/75">
            {text}
          </p>
          <ButtonLink href={href} variant="yellow" className="mt-9">
            {button}
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}

/*--A picture next to a block of text, alternating sides--*/
export function Feature({
  title,
  eyebrow,
  id,
  image,
  imageAlt = "",
  reverse,
  children,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: string;
  id?: string;
  image: string;
  imageAlt?: string;
  reverse?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-14 md:py-24", className)}>
      <Container className="grid items-center gap-10 md:grid-cols-2 md:gap-20">
        <div className={cn("reveal relative", reverse && "md:order-2")}>
          <div
            aria-hidden="true"
            className={cn(
              "absolute -bottom-4 -z-0 h-full w-full rounded-3xl bg-brand-mint",
              reverse ? "-left-4" : "-right-4",
            )}
          />
          <Image
            src={image}
            alt={imageAlt}
            width={1024}
            height={768}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="relative h-auto w-full rounded-3xl object-cover shadow-[var(--shadow-lift)]"
          />
        </div>
        <div className={cn("reveal", reverse && "md:order-1")}>
          {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
          <h2 className="mb-6 text-3xl leading-tight md:text-[44px]">
            {title}
          </h2>
          {children}
        </div>
      </Container>
    </section>
  );
}

/*--A page section with consistent spacing and one of a few background tones--*/
const tones = {
  snow: "bg-brand-snow",
  white: "bg-white",
  mint: "bg-brand-mint/60",
  cream: "bg-brand-cream",
  navy: "relative isolate overflow-hidden bg-brand-navy text-white",
} as const;

export function Section({
  tone = "snow",
  className,
  containerClassName,
  children,
  id,
}: {
  tone?: keyof typeof tones;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-24 py-16 md:py-24", tones[tone], className)}
    >
      {tone === "navy" && (
        <div
          aria-hidden="true"
          className="absolute -top-40 left-1/4 -z-10 size-[520px] rounded-full bg-brand-green/25 blur-[120px]"
        />
      )}
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}

/*--Label + serif heading + optional intro paragraph--*/
export function SectionHeading({
  eyebrow,
  title,
  intro,
  center,
  light,
  as: Tag = "h2",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  center?: boolean;
  light?: boolean;
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "reveal max-w-[760px]",
        center && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow && <Eyebrow light={light}>{eyebrow}</Eyebrow>}
      <Tag
        className={cn(
          "text-3xl leading-tight md:text-[44px]",
          eyebrow && "mt-4",
          light && "text-white",
        )}
      >
        {title}
      </Tag>
      {intro && (
        <div
          className={cn(
            "mt-5 text-[16px] leading-8",
            light ? "text-white/70" : "text-brand-slate",
          )}
        >
          {intro}
        </div>
      )}
    </div>
  );
}

/*--Readable body text--*/
export const prose = "space-y-5 text-[16px] leading-8 text-brand-slate";

/*--A white card with an icon, a title and text--*/
export function IconCard({
  Icon,
  title,
  children,
  className,
}: {
  Icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "reveal group flex flex-col rounded-3xl border border-brand-navy/5 bg-white p-7 shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] md:p-8",
        className,
      )}
    >
      {Icon && (
        <span className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-brand-mint text-brand-green transition-colors duration-500 group-hover:bg-brand-green group-hover:text-white">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      )}
      <h3 className="text-lg leading-snug font-semibold text-brand-navy">
        {title}
      </h3>
      {children && (
        <div className="mt-3 flex-1 text-[15px] leading-7 text-brand-slate">
          {children}
        </div>
      )}
    </article>
  );
}

/*--Page header for pages without a photo banner: a soft gradient, label, title and intro--*/
export function PageHeader({
  eyebrow = "BSREA",
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-brand-navy/5 bg-gradient-to-b from-brand-mint/70 to-brand-snow pt-16 pb-14 md:pt-24 md:pb-20">
      <div
        aria-hidden="true"
        className="absolute -top-32 right-[-10%] -z-10 size-[420px] rounded-full bg-brand-yellow/15 blur-[100px]"
      />
      <Container>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-3xl text-4xl leading-[1.1] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 md:text-[56px]">
          {title}
        </h1>
        {intro && (
          <div className="mt-5 max-w-2xl text-lg leading-8 text-brand-slate">
            {intro}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}
