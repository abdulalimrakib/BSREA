import type { Metadata } from "next";
import Image from "next/image";
import { Mail, Phone } from "lucide-react";
import { site, telHref } from "@/lib/site";
import { Container, PageHeader } from "@/components/site/blocks";

export const metadata: Metadata = { title: "Management" };

// Staff members' personal mobile numbers are deliberately not published; visitors use the office's phone and email

const staff = [
  {
    name: "Md. Motahar Hossain",
    role: "Executive",
    photo:
      "/uploads/elementor/thumbs/Asset-10@2x-rk52bcai26107xpqikyf1m1kfywp0fmnwee4j2x35w.png",
  },
  {
    name: "Abdullah Al Alif",
    role: "Officer Admin & Accounts",
    photo:
      "/uploads/elementor/thumbs/Alif-bhai-rjy81t4s0vs6exe7zwnj6aqubhzkcn2xc38115xjyc.png",
  },
  {
    name: "Shaikh Muhammad Abdullha",
    role: "Branding & Communication Officer",
    photo:
      "/uploads/elementor/thumbs/shaikh-muhammad-abdullha-rjy9t6f2rsj34jciysr2rt2k1nnea1nh1qjgrpz2h0.jpg",
  },
  {
    name: "Maria Akhter Aninda",
    role: "Event & Program Officer",
    photo:
      "/uploads/elementor/thumbs/maria-apu_1@2x-rk57bcduu0frjo91fe0fj6tbqbp51s86nbvj0o0zlw.png",
  },
];

export default function ManagementPage() {
  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Secretariat"
        intro="Responsible for executing programs, managing operations, and supporting the Board."
      />
      <section className="py-16 md:py-24">
        <Container>
          <article className="reveal mx-auto grid max-w-[860px] items-center gap-8 rounded-[2rem] border border-brand-navy/5 bg-white p-6 shadow-[var(--shadow-soft)] sm:grid-cols-[220px_1fr] md:gap-12 md:p-10">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-b from-brand-cream to-brand-mist">
              <Image
                src="/uploads/2026/03/munir-sir@2x.png"
                alt="Advocate A.S.M Munir"
                width={757}
                height={768}
                className="h-auto w-full"
              />
            </div>
            <div className="text-center sm:text-left">
              <p className="inline-block rounded-full bg-brand-mint px-3 py-1 text-xs font-semibold text-brand-green">
                Secretary General
              </p>
              <h2 className="mt-4 text-3xl md:text-4xl">
                Advocate A.S.M Munir
              </h2>
              <a
                href="mailto:munir@bsreabd.org"
                className="mt-4 inline-flex items-center gap-2 text-sm text-brand-slate transition-colors hover:text-brand-green"
              >
                <Mail className="size-4" aria-hidden="true" /> munir@bsreabd.org
              </a>
            </div>
          </article>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {staff.map((person) => (
              <article
                key={person.name}
                className="reveal group overflow-hidden rounded-3xl border border-brand-navy/5 bg-white text-center shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
              >
                <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-brand-cream to-brand-mist">
                  <Image
                    src={person.photo}
                    alt={person.name}
                    fill
                    sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover object-top transition-transform duration-700 ease-[var(--ease-smooth)] group-hover:scale-[1.04]"
                  />
                </div>
                <div className="px-5 py-6">
                  <h3 className="font-serif text-xl font-semibold text-brand-navy">
                    {person.name}
                  </h3>
                  <p className="mt-1 text-sm text-brand-slate">{person.role}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="reveal mt-16 flex flex-col items-center justify-center gap-3 rounded-3xl bg-brand-navy px-6 py-8 text-center text-white sm:flex-row sm:gap-6">
            <span className="font-serif text-xl">Contact the secretariat</span>
            <a
              href={telHref(site.phone)}
              className="inline-flex items-center gap-2 text-white/80 transition-colors hover:text-brand-yellow"
            >
              <Phone className="size-4 text-brand-yellow" aria-hidden="true" />{" "}
              {site.phone}
            </a>
            <a
              href={`mailto:${site.email}`}
              className="inline-flex items-center gap-2 text-white/80 transition-colors hover:text-brand-yellow"
            >
              <Mail className="size-4 text-brand-yellow" aria-hidden="true" />{" "}
              {site.email}
            </a>
          </div>
        </Container>
      </section>
    </>
  );
}
