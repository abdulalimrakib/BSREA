import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight, FileText } from "lucide-react";
import { Container, Eyebrow, PageBanner } from "@/components/site/blocks";
import SocialIcon from "@/components/site/social-icon";
import { socials } from "@/lib/site";

export const metadata: Metadata = { title: "Publications" };

const publications = [
  { title: "Annual Report 2025", href: "/uploads/2026/01/BSREA-AR-25.pdf" },
  {
    title: "Brochure of Responsible Use of Electricity",
    href: "https://drive.google.com/open?id=18-rxswaQgtLwndUeo6HN5NH4TSeTBZhB",
  },
  {
    title: "Conference on Green Finance of Sustainable Development Publication",
    href: "https://drive.google.com/open?id=18c0bAHZnKj4GN4RJtRiCeYB5S06LHqCs",
  },
  {
    title: "Leaflet",
    href: "https://drive.google.com/open?id=1B2RBHlMfa3OCL_rN6KjMb4-Zj1VQxK6-",
  },
  {
    title: "NewsLetter -Jul – Dec-2012",
    href: "https://drive.google.com/open?id=1Hi-Q9Y13qEqlENNO6N5a9apgxSecM4Bl",
  },
];

export default function PublicationsPage() {
  return (
    <>
      <PageBanner
        title="BSREA Publications"
        image="/uploads/2025/04/solar-panels-against-blue-sunny-sky-produce-green-environmentally-friendly-energy-from-sun-blue.jpg"
      />
      <section className="py-16 md:py-24">
        <Container className="grid items-start gap-12 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
          <div className="reveal">
            <Eyebrow>Library</Eyebrow>
            <h2 className="mt-4 text-3xl leading-tight md:text-[44px]">
              Reports, brochures and newsletters
            </h2>
            <div className="mt-8 overflow-hidden rounded-3xl shadow-[var(--shadow-lift)]">
              <Image
                src="/uploads/2025/05/1737478070236-300x169.jpg"
                alt="BSREA members"
                width={300}
                height={169}
                className="h-auto w-full"
              />
            </div>
            <p className="mt-8 text-xs font-semibold tracking-[0.2em] text-brand-gray uppercase">
              Follow Us
            </p>
            <div className="mt-3 flex gap-2">
              {socials.map((s) => (
                <a
                  key={s.network}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex size-10 items-center justify-center rounded-full border border-brand-navy/10 text-brand-navy transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-green hover:text-brand-green"
                >
                  <SocialIcon network={s.network} className="size-4" />
                </a>
              ))}
            </div>
          </div>
          <ul className="space-y-3">
            {publications.map((pub) => (
              <li key={pub.title} className="reveal">
                <a
                  href={pub.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 rounded-2xl border border-brand-navy/5 bg-white p-5 shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-0.5 hover:border-brand-green/30 hover:shadow-[var(--shadow-lift)]"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-mint text-brand-green transition-colors duration-500 group-hover:bg-brand-green group-hover:text-white">
                    <FileText className="size-5" aria-hidden="true" />
                  </span>
                  <span className="flex-1 font-medium text-brand-navy">
                    {pub.title}
                  </span>
                  <ArrowUpRight
                    className="size-5 text-brand-gray transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-green"
                    aria-hidden="true"
                  />
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </>
  );
}
