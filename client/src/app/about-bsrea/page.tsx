import type { Metadata } from "next";
import {
  Building2,
  Handshake,
  Landmark,
  Megaphone,
  Microscope,
} from "lucide-react";
import {
  Eyebrow,
  Feature,
  IconCard,
  JoinCta,
  PageBanner,
  prose,
  Section,
  SectionHeading,
} from "@/components/site/blocks";
import YouTubeEmbed from "@/components/site/youtube-embed";

export const metadata: Metadata = { title: "About BSREA" };

const initiatives = [
  {
    Icon: Landmark,
    title: "Policy Advocacy & Government Collaboration",
    text: "BSREA actively engages with the government to shape policies that facilitate the growth of the renewable energy sector. Our primary partner is the Ministry of Power, Energy and Mineral Resources, and we also work closely with the Ministry of Finance, Ministry of Commerce, and other key government bodies to promote clean energy initiatives.",
  },
  {
    Icon: Building2,
    title: "Industry Development & Business Support",
    text: "We provide a strong networking platform for renewable energy businesses, helping members connect with potential partners, investors, and international stakeholders. BSREA fosters collaboration between solar power developers, wind energy investors, hydropower projects, and energy efficiency service providers to create a thriving clean energy market in Bangladesh.",
  },
  {
    Icon: Handshake,
    title: "Financial & Institutional Partnerships",
    text: "BSREA collaborates with key financial and regulatory institutions such as Bangladesh Bank (the central bank of Bangladesh), Sustainable & Renewable Energy Development Authority (SREDA), Power Cell, Federation of Bangladesh Chambers of Commerce and Industry (FBCCI), and Infrastructure Development Company Limited (IDCOL).",
  },
  {
    Icon: Microscope,
    title: "Research & Capacity Building",
    text: "We organize seminars, workshops, and training programs to enhance knowledge sharing and capacity building within the renewable energy sector. By bringing together experts, researchers, and industry leaders, we aim to drive innovation and technological advancements that can transform the energy landscape of Bangladesh.",
  },
  {
    Icon: Megaphone,
    title: "Public Awareness & Education",
    text: "Raising awareness about the benefits of renewable energy is a core part of our mission. We conduct outreach programs, publish reports, and leverage media channels to educate businesses, policymakers, and the general public about the potential of clean energy solutions in ensuring energy security and environmental sustainability.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageBanner
        title="About BSREA"
        image="/uploads/2026/02/pexels-kelly-4320475-scaled.jpg"
      />

      <Section
        tone="white"
        containerClassName="grid items-center gap-12 md:grid-cols-2 md:gap-20"
      >
        <div className="reveal">
          <Eyebrow>Who We Are</Eyebrow>
          <h2 className="mt-4 text-4xl leading-tight md:text-[52px]">
            About Us
          </h2>
          <div className={`mt-6 ${prose}`}>
            <p>
              Bangladesh Sustainable and Renewable Energy Association (BSREA) is
              the largest platform for businesses and organizations driving the
              clean energy revolution in Bangladesh. Established in 2011, BSREA
              is a non-profit organization dedicated to promoting sustainable
              and renewable energy solutions, fostering industry growth, and
              advocating for policies that support a cleaner, greener future.
            </p>
            <p>
              With 170+ active members and 21 executive members, BSREA serves as
              a unified voice for renewable energy companies, non-governmental
              organizations (NGOs), financial institutions, researchers, and
              policymakers working together to accelerate Bangladesh’s
              transition to a sustainable energy future.
            </p>
          </div>
        </div>
        <div className="reveal">
          <YouTubeEmbed
            url="https://www.youtube.com/watch?v=QtuykURZdm0"
            title="Mostafa Al Mahmud, President, BSREA"
            className="rounded-3xl shadow-[var(--shadow-lift)]"
          />
          <p className="mt-4 text-center text-sm text-brand-gray">
            Mostafa Al Mahmud, President, BSREA
          </p>
        </div>
      </Section>

      <Feature
        title="Our Mission"
        image="/uploads/2025/04/IMG_2133-1.jpg"
        imageAlt="BSREA signing ceremony"
      >
        <p className={prose}>
          Our mission is to accelerate the adoption of renewable energy
          technologies in Bangladesh, creating an environment that fosters
          investment, policy development, and strong industry collaboration to
          ensure energy security and environmental sustainability.
        </p>
      </Feature>

      <Feature
        title="Our Vision"
        image="/uploads/2025/04/aerial-drone-view-into-large-solar-panels-at-a-solar-farm-at-bright-sunset-solar-cell-power-plants--1024x768.jpg"
        imageAlt="Solar farm at sunset"
        reverse
        className="pt-0 md:pt-0"
      >
        <p className={prose}>
          We envision a future where Bangladesh leads the way in renewable
          energy, leveraging clean energy solutions to power communities,
          enhance economic growth, and promote environmental stewardship.
        </p>
      </Feature>

      <Section tone="cream">
        <div className="grid gap-8 md:grid-cols-2 md:gap-16">
          <SectionHeading eyebrow="What We Do" title="Our Core Initiatives" />
          <p className={`reveal md:pt-10 ${prose}`}>
            We are dedicated to advancing the renewable energy sector in
            Bangladesh through a multi-faceted approach. Our initiatives include
            policy advocacy and government collaboration to influence clean
            energy policies, fostering industry growth by connecting renewable
            energy businesses with key stakeholders, and building strategic
            financial and institutional partnerships to unlock funding
            opportunities.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {initiatives.map(({ Icon, title, text }) => (
            <IconCard key={title} Icon={Icon} title={title}>
              {text}
            </IconCard>
          ))}
        </div>
      </Section>

      <JoinCta />
    </>
  );
}
