import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  ButtonLink,
  Container,
  Eyebrow,
  PageHeader,
  prose,
} from "@/components/site/blocks";
import SocialIcon from "@/components/site/social-icon";
import { site, socials, telHref } from "@/lib/site";

export const metadata: Metadata = { title: "BSREA Newsletter" };

const moreStories = [
  {
    title: "BSREA Signs MoU with Savor International for RENEX 2026",
    slug: "bsrea-partners-with-savor-international-for-renex-2026",
  },
  {
    title: "BSREA Delegation Meets State Minister Anindya Islam Amit",
    slug: "courtesy-meeting-with-state-minister-anindya-islam-amit",
  },
  {
    title: "Driving the Dialogue on Renewable Energy Sovereignty",
    slug: "driving-the-dialogue-on-renewable-energy-sovereignty",
  },
  {
    title: "Renewable Energy Transition and Decarbonization in the RMG Sector",
    slug: "bsrea-participated-in-the-multi-stakeholder-policy-dialogue-on-renewable-energy-transition-decarbonisation-in-bangladeshs-rmg-sector",
  },
  {
    title:
      "Navigating the Global Energy Shock: Impact on Bangladesh and Way Forward",
    slug: "navigating-the-global-energy-shock-impact-on-bangladesh-and-way-forward",
  },
  {
    title:
      "BSREA Calls for Urgent Renewable Energy Transition Amid Deepening Energy Crisis",
    slug: "bsrea-calls-for-urgent-renewable-energy-transition-amid-deepening-energy-crisis",
  },
  {
    title: "BSREA Hosts Seminar on Energy Security and Renewable Transition",
    slug: "bsrea-hosts-seminar-on-energy-security-and-renewable-transition",
  },
];

export default function NewsletterPage() {
  return (
    <>
      <PageHeader eyebrow="Media Center" title="BSREA Newsletter" />

      <section className="py-14 md:py-20">
        <Container className="max-w-[1080px] space-y-20">
          <div className="text-center">
            <Image
              src="/uploads/2026/06/Asset-3@2x-1024x250.png"
              alt="BSREA Newsletter"
              width={1024}
              height={250}
              priority
              className="mx-auto h-auto w-full"
            />
            <p className="mt-6 text-sm font-medium text-brand-slate">
              Newsletter E-mail:{" "}
              <a
                href={`mailto:${site.email}`}
                className="hover:text-brand-green"
              >
                {site.email}
              </a>{" "}
              Phone:{" "}
              <a href={telHref(site.phone)} className="hover:text-brand-green">
                +880 9647 200 500
              </a>
            </p>
          </div>

          {/* AGM */}
          <article className="reveal grid items-center gap-8 md:grid-cols-2">
            <Image
              src="/uploads/2026/06/A2H001-265-Copy-1024x549.jpg"
              alt="11th Annual General Meeting of BSREA"
              width={1024}
              height={549}
              className="h-auto w-full rounded-3xl shadow-[var(--shadow-soft)]"
            />
            <div>
              <h2 className="text-3xl leading-tight md:text-4xl">
                <Link
                  href="/the-11th-annual-general-meeting-agm-of-the-bangladesh-sustainable-and-renewable-energy-association-bsrea"
                  className="hover:text-brand-green"
                >
                  11th Annual General Meeting (AGM)
                </Link>
              </h2>
              <p className={`mt-4 ${prose}`}>
                The 11th AGM of BSREA brought together industry leaders,
                members, and development partners to discuss the future of
                renewable energy in Bangladesh. The discussions emphasized a
                critical reality: renewable energy is no longer optional—it is
                central to energy security, economic resilience, and sustainable
                growth.
              </p>
              <p className="mt-5 inline-block rounded-full bg-brand-mint px-3 py-1 text-xs font-semibold text-brand-green">
                17 January
              </p>
            </div>
          </article>

          {/* Citizens' manifesto */}
          <article className="reveal grid items-center gap-8 md:grid-cols-[1fr_1.4fr]">
            <p className={`max-md:order-2 ${prose}`}>
              The Citizens’ Manifesto: “Public Ownership of Energy” was unveiled
              on 2 February 2026 at the National Press Club, Dhaka, by JETnet BD
              in collaboration with ActionAid Bangladesh. The event brought
              together over 100 organizations, energy experts, and civil society
              representatives to discuss citizen-driven priorities for
              Bangladesh’s energy future, emphasizing transparency, reduced
              fossil fuel dependence, and inclusive governance. BSREA supported
              the initiative by advocating for renewable energy and
              people-centered, participatory energy policymaking.
            </p>
            <Image
              src="/uploads/2026/06/Asset-4@2x-1024x533.png"
              alt="Citizens’ Voice and the Future of Energy Policy, 2 February: “Bangladesh’s energy future should be clean, inclusive, and driven by the collective aspirations of its people.” — President, BSREA"
              width={1024}
              height={533}
              className="h-auto w-full rounded-3xl shadow-[var(--shadow-soft)]"
            />
          </article>

          {/* Tannery sector + sovereign risk */}
          <article className="reveal grid gap-8 md:grid-cols-[1.1fr_1fr]">
            <Image
              src="/uploads/2026/06/Asset-5@2x.png"
              alt="BSREA at the Private Sector Renewable Energy Forum"
              width={561}
              height={325}
              className="h-auto w-full rounded-3xl shadow-[var(--shadow-soft)]"
            />
            <div>
              <h2 className="text-2xl leading-tight md:text-3xl">
                Driving Renewable Energy Adoption in Bangladesh’s Tannery Sector
              </h2>
              <p className="mt-4 inline-block rounded-full bg-brand-mint px-3 py-1 text-xs font-semibold text-brand-green">
                18 February
              </p>
              <ButtonLink
                href="/bsrea-participated-in-the-private-sector-renewable-energy-forum-psref-session"
                variant="outline"
                className="mt-6"
              >
                Read More
              </ButtonLink>
            </div>
          </article>
          <article className="reveal grid gap-8 md:grid-cols-[1fr_2fr]">
            <div className="md:text-right">
              <h2 className="text-2xl leading-tight md:text-3xl">
                Bangladesh&apos;s Sovereign Risk Trap
              </h2>
              <p className="mt-4 inline-block rounded-full bg-brand-mint px-3 py-1 text-xs font-semibold text-brand-green">
                18 February
              </p>
            </div>
            <div>
              <p className={prose}>
                The roundtable titled “Corruption by Design, Debt by Default:
                How Governance Failure Fuels Bangladesh’s Sovereign Risk Trap”
                was held on 18 February 2026 at CIRDAP Auditorium, Dhaka, as a
                high-level policy and research dialogue. Organized by Change
                Initiative in partnership with SOAS University of London, it
                brought together policymakers, …
              </p>
              <ButtonLink
                href="/bsrea-was-honored-to-participate-in-the-high-level-roundtable-titled-corruption-by-design-debt-by-default-how-governance-failure-fuels-bangladeshs-sovereign-risk-trap"
                variant="outline"
                className="mt-6"
              >
                Read More
              </ButtonLink>
            </div>
          </article>

          {/* ActionAid MoU */}
          <article className="reveal">
            <Image
              src="/uploads/2026/06/WhatsApp-Image-2026-03-01-at-4.01.13-PM-2-1024x461.jpeg"
              alt="BSREA and ActionAid Bangladesh MoU signing"
              width={1024}
              height={461}
              className="h-auto w-full rounded-3xl shadow-[var(--shadow-soft)]"
            />
            <h2 className="mt-6 text-2xl leading-tight md:text-3xl">
              <Link
                href="/bsrea-signs-mou-with-actionaid-bangladesh-to-advance-a-just-energy-transition"
                className="hover:text-brand-green"
              >
                BSREA and ActionAid Bangladesh Sign MoU for a Just Energy
                Transition
              </Link>
            </h2>
          </article>

          {/* More stories */}
          <div>
            <Eyebrow>More stories</Eyebrow>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {moreStories.map((story) => (
                <Link
                  key={story.slug}
                  href={`/${story.slug}`}
                  className="reveal group flex min-h-[140px] flex-col justify-between rounded-3xl bg-brand-navy p-6 transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-1 hover:bg-brand-green"
                >
                  <span className="font-serif text-lg leading-snug text-white">
                    {story.title}
                  </span>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-yellow">
                    Read{" "}
                    <ArrowRight
                      className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-2">
            {socials.map((s) => (
              <a
                key={s.network}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex size-11 items-center justify-center rounded-full border border-brand-navy/10 text-brand-navy transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-green hover:text-brand-green"
              >
                <SocialIcon network={s.network} className="size-4" />
              </a>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
