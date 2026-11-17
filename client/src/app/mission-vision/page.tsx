import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Feature,
  JoinCta,
  PageBanner,
  Section,
  SectionHeading,
} from "@/components/site/blocks";

export const metadata: Metadata = { title: "Mission & Vision" };

const projects = [
  {
    title: "Amar Gram Amar Shohor",
    text: "Transforming villages into smart, sustainable communities with renewable energy solutions to ensure energy security and a better quality of life.",
    anchor: "amar-gram-amar-shohor",
  },
  {
    title: "Responsible Use of Electricity",
    text: "Promoting energy-conscious behavior and supporting climate change mitigation efforts through public awareness and campaigns.",
    anchor: "responsible-use-of-electricity",
  },
  {
    title: "Achieving SDGs",
    text: "Advancing the sustainable development goals by integrating renewable energy solutions to tackle poverty, hunger, and climate change.",
    anchor: "achieving-sdgs",
  },
  {
    title: "Green Finance",
    text: "Advocating for green finance to enable investments in renewable energy, ensuring the commercialization and growth of the clean energy sector.",
    anchor: "green-finance",
  },
];

export default function MissionVisionPage() {
  return (
    <>
      <PageBanner
        title="Mission & Vision"
        image="/uploads/2025/04/solar-panels-against-blue-sunny-sky-produce-green-environmentally-friendly-energy-from-sun-blue.jpg"
      />

      <Feature
        title="Our Mission"
        image="/uploads/elementor/thumbs/IMG_2139-1-r5ut1ve89wohnig3e8l9f9e0hdtjrqv6yndzdodji8.jpg"
        reverse
      >
        <div className="rich-text">
          <p>
            At Bangladesh Sustainable and Renewable Energy Association (BSREA),
            our mission is to facilitate the adoption and development of
            renewable energy technologies across Bangladesh.
            <br />
            We are committed to:
          </p>
          <ul>
            <li>
              <strong>Promoting investment</strong> in sustainable energy
              initiatives.
            </li>
            <li>
              <strong>Advocating for supportive policies</strong> that encourage
              clean energy solutions.
            </li>
            <li>
              <strong>Strengthening industry collaboration</strong> among
              businesses, government agencies, and development partners.
            </li>
          </ul>
          <p>
            Through these efforts, we aim to{" "}
            <strong>enhance energy security</strong>,{" "}
            <strong>reduce carbon emissions</strong>, and{" "}
            <strong>foster economic growth</strong> — paving the way for a
            cleaner, greener future for all.
          </p>
        </div>
      </Feature>

      <Feature
        title="Our Vision"
        image="/uploads/2025/04/solar-pannels-1024x1024.jpg"
        className="pt-0 md:pt-0"
      >
        <div className="rich-text">
          <p>
            We envision a Bangladesh where{" "}
            <strong>
              sustainable and renewable energy leads the way to national
              prosperity
            </strong>
            .
            <br />
            Our vision is to:
          </p>
          <ul>
            <li>
              Position Bangladesh as a <strong>regional leader</strong> in
              renewable energy innovation and implementation.
            </li>
            <li>
              Empower communities, businesses, and industries to{" "}
              <strong>thrive on clean energy</strong>.
            </li>
            <li>
              Ensure <strong>environmental sustainability</strong> and{" "}
              <strong>economic prosperity</strong> through the widespread use of
              renewable resources.
            </li>
          </ul>
          <p>
            At BSREA, we believe that by harnessing the power of solar, wind,
            biogas, and other clean energy solutions, Bangladesh can achieve a
            future that is{" "}
            <strong>
              energy-secure, resilient, and environmentally responsible
            </strong>
            .
          </p>
        </div>
      </Feature>

      <Section tone="mint">
        <SectionHeading
          eyebrow="Projects"
          title="Our Ongoing Projects"
          center
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {projects.map((project, index) => (
            <Link
              key={project.title}
              href={`/projects#${project.anchor}`}
              className="reveal group flex flex-col rounded-3xl bg-white p-7 shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
            >
              <span className="font-serif text-3xl text-brand-yellow">
                0{index + 1}
              </span>
              <h3 className="mt-4 text-lg leading-snug font-semibold text-brand-navy transition-colors group-hover:text-brand-green">
                {project.title}
              </h3>
              <p className="mt-3 flex-1 text-[15px] leading-7 text-brand-slate">
                {project.text}
              </p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-green">
                View more{" "}
                <ArrowRight
                  className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <JoinCta />
    </>
  );
}
