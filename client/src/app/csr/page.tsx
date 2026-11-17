import type { Metadata } from "next";
import Image from "next/image";
import {
  Eyebrow,
  JoinCta,
  PageBanner,
  prose,
  Section,
  SectionHeading,
} from "@/components/site/blocks";
import SolarPanelIcon from "@/components/site/solar-panel-icon";

export const metadata: Metadata = { title: "CSR" };

const initiatives = [
  {
    title: "Renewable Energy Awareness Campaigns",
    text: "We organize workshops, seminars, and training programs to educate communities on the benefits of renewable energy and energy efficiency.",
  },
  {
    title: "Solar Solutions for Underserved Communities",
    text: "BSREA collaborates with stakeholders to bring solar-powered solutions to remote and off-grid areas, enhancing access to clean electricity.",
  },
  {
    title: "Green Schools Program",
    text: "Encouraging the next generation to adopt sustainability by supporting educational institutions with solar installations and eco-friendly initiatives.",
  },
  {
    title: "Tree Plantation & Carbon Offset Programs",
    text: "To combat climate change, BSREA actively participates in tree plantation drives and carbon reduction projects.",
  },
  {
    title: "Workforce Development & Skill Training",
    text: "We support skill development programs in the renewable energy sector, creating job opportunities for youth and underprivileged groups",
  },
];

export default function CsrPage() {
  return (
    <>
      <PageBanner
        title="CSR"
        image="/uploads/2025/04/floating-solar-panels-providing-green-energy-renewable-energy-1-1.jpg"
      />

      <Section
        tone="white"
        containerClassName="grid items-center gap-12 md:grid-cols-2 md:gap-20"
      >
        <div className="reveal">
          <Eyebrow>BSREA’s Commitment</Eyebrow>
          <h2 className="mt-4 text-3xl leading-tight md:text-[44px]">
            Corporate Social Responsibility (CSR)
          </h2>
          <p className={`mt-6 ${prose}`}>
            At Bangladesh Sustainable and Renewable Energy Association (BSREA),
            we believe that sustainability goes beyond energy solutions—it’s
            about creating a lasting positive impact on society and the
            environment. Our Corporate Social Responsibility (CSR) initiatives
            are dedicated to empowering communities, promoting clean energy
            awareness, and fostering environmental sustainability.
          </p>
        </div>
        <div className="reveal relative aspect-square overflow-hidden rounded-3xl shadow-[var(--shadow-lift)]">
          <Image
            src="/uploads/2025/04/sustainable-source-and-renewable-energy-concept-with-abstract-green-nature-background--1024x1024.jpg"
            alt="Renewable energy concept on a green background"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      </Section>

      <Section tone="navy">
        <SectionHeading
          eyebrow="Initiatives"
          title="Our Key CSR Initiatives"
          center
          light
        />
        <div className="mt-12 flex flex-wrap justify-center gap-5">
          {initiatives.map((item) => (
            <article
              key={item.title}
              className="reveal group w-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-sm transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-1 hover:border-brand-yellow/40 hover:bg-white/[0.07] sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-yellow/10 text-brand-yellow transition-colors duration-500 group-hover:bg-brand-yellow group-hover:text-brand-navy">
                <SolarPanelIcon className="size-6" />
              </span>
              <h3 className="mt-6 text-lg leading-snug font-semibold text-white">
                {item.title}
              </h3>
              <p className="mt-3 text-[15px] leading-7 text-white/65">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <JoinCta title="BSREA remains committed to fostering a greener, more sustainable, and energy-secure Bangladesh." />
    </>
  );
}
