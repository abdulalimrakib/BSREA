import type { Metadata } from "next";
import Image from "next/image";
import {
  BadgeDollarSign,
  CheckCircle2,
  GraduationCap,
  Landmark,
  Megaphone,
  Network,
  SunMedium,
} from "lucide-react";
import {
  Eyebrow,
  IconCard,
  JoinCta,
  PageBanner,
  Section,
  SectionHeading,
} from "@/components/site/blocks";

export const metadata: Metadata = { title: "Member Welfare" };

const initiatives = [
  {
    Icon: Landmark,
    title: "Advocacy and Policy Influence",
    text: [
      "We represent our members’ interests at the highest levels, advocating for favorable clean energy policies, regulations, and incentives.",
      "Through continuous engagement with government agencies and policymakers, we work to create a business-friendly environment for the renewable energy sector.",
    ],
  },
  {
    Icon: Network,
    title: "Stakeholder Engagement and Networking",
    text: [
      "BSREA connects members with key industry stakeholders — including government bodies, private sector partners, NGOs, and international investors.",
      "Our platform fosters collaboration, dialogue, and new business opportunities across the renewable energy ecosystem.",
    ],
  },
  {
    Icon: SunMedium,
    title: "Promotion of Renewable Energy Technologies",
    text: [
      "We actively promote solar, wind, biogas, and energy-efficient technologies, highlighting our members’ innovations through exhibitions, seminars, and media outreach.",
      "This helps increase visibility and market reach for our members’ solutions.",
    ],
  },
  {
    Icon: GraduationCap,
    title: "Capacity Building and Skill Development",
    text: [
      "Through specialized workshops, training programs, and knowledge-sharing initiatives, we help members and their teams stay updated on industry best practices, new technologies, and regulatory changes.",
    ],
  },
  {
    Icon: BadgeDollarSign,
    title: "Financial Support and Investment Facilitation",
    text: [
      "We assist members in accessing financial resources and investment opportunities by working closely with banks, development partners, and funding agencies.",
      "Our goal is to enable sustainable growth for clean energy businesses.",
    ],
  },
  {
    Icon: Megaphone,
    title: "Public Awareness and Market Development",
    text: [
      "BSREA leads public awareness campaigns to build support for renewable energy adoption.",
      "By expanding public understanding and demand for clean energy, we help create a stronger and more vibrant market for our members’ products and services.",
    ],
  },
];

const commitments = [
  "Protecting and promoting the interests of our members",
  "Providing access to knowledge, networks, and growth opportunities",
  "Ensuring our members’ voices are heard in key policy discussions",
  "Supporting the professional development and success of every member",
];

export default function MemberWelfarePage() {
  return (
    <>
      <PageBanner
        title="Members’ Welfare"
        image="/uploads/2025/04/IMG_2194-1.jpg"
      />

      <Section>
        <SectionHeading
          eyebrow="Members’ Welfare"
          title="Supporting the success of every member"
          center
          intro={
            <p>
              At BSREA, we believe that the strength of our association lies in
              the success and well-being of our members. Our Members’ Welfare
              initiatives are designed to provide valuable support, foster
              business growth, and empower our members to lead the transition
              towards a sustainable energy future.
            </p>
          }
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {initiatives.map(({ Icon, title, text }) => (
            <IconCard key={title} Icon={Icon} title={title}>
              <div className="space-y-2">
                {text.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </IconCard>
          ))}
        </div>
      </Section>

      <Section
        tone="white"
        containerClassName="grid items-center gap-12 md:grid-cols-2 md:gap-20"
      >
        <div className="reveal">
          <Eyebrow>Our Promise</Eyebrow>
          <h2 className="mt-4 text-3xl leading-tight md:text-[44px]">
            Our Commitment to Our Members
          </h2>
          <p className="mt-6 font-semibold text-brand-navy">
            At BSREA, we are committed to:
          </p>
          <ul className="mt-5 space-y-4">
            {commitments.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-[16px] leading-7 text-brand-slate"
              >
                <CheckCircle2
                  className="mt-1 size-5 shrink-0 text-brand-green"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[16px] leading-8 text-brand-slate">
            Together, we can build a future where clean, affordable, and
            reliable energy is accessible to all — and where our members lead
            the way in creating a sustainable Bangladesh.
          </p>
        </div>
        <div className="reveal relative">
          <div
            aria-hidden="true"
            className="absolute inset-0 translate-x-4 translate-y-4 rounded-3xl bg-brand-mint"
          />
          <Image
            src="/uploads/2025/04/IMG_2158-1.jpg"
            alt="BSREA members at an event"
            width={1024}
            height={683}
            className="relative h-auto w-full rounded-3xl shadow-[var(--shadow-lift)]"
          />
        </div>
      </Section>

      <JoinCta />
    </>
  );
}
