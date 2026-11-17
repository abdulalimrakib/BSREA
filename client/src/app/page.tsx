import type React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Handshake,
  Landmark,
  Lightbulb,
  Megaphone,
  Network,
  Quote,
  Telescope,
} from "lucide-react";
import HeroSlideshow from "@/components/home/hero-slideshow";
import MemberLogos from "@/components/home/member-logos";
import {
  ButtonLink,
  Container,
  Eyebrow,
  JoinCta,
} from "@/components/site/blocks";
import { PostCardCompact } from "@/components/site/post-card";
import YouTubeEmbed from "@/components/site/youtube-embed";
import { getMemberLogos, getPosts } from "@/lib/content";
import { cn } from "@/lib/utils";

const whatWeDo = [
  {
    Icon: Landmark,
    title: "Policy Advocacy & Government Collaboration",
    text: "BSREA actively engages with the government to shape policies that facilitate the growth of the renewable energy sector. Our primary partner is the Ministry of Power, Energy and Mineral Resources, and we also work closely with the Ministry of Finance, Ministry of Commerce, and other key government bodies to promote clean energy initiatives.",
  },
  {
    Icon: Network,
    title: "Industry Development & Business Support",
    text: "We provide a strong networking platform for renewable energy businesses, helping members connect with potential partners, investors, and international stakeholders. BSREA fosters collaboration between solar power developers, wind energy investors, hydropower projects, and energy efficiency service providers to create a thriving clean energy market in Bangladesh.",
  },
  {
    Icon: Handshake,
    title: "Financial & Institutional Partnerships",
    text: "BSREA collaborates with key financial and regulatory institutions such as Bangladesh Bank (the central bank of Bangladesh), Sustainable & Renewable Energy Development Authority (SREDA), Power Cell, Federation of Bangladesh Chambers of Commerce and Industry (FBCCI), and Infrastructure Development Company Limited (IDCOL).",
  },
  {
    Icon: BookOpen,
    title: "Research & Capacity Building",
    text: "We organize seminars, workshops, and training programs to enhance knowledge sharing and capacity building within the renewable energy sector. By bringing together experts, researchers, and industry leaders, we aim to drive innovation and technological advancements that can transform the energy landscape of Bangladesh.",
  },
  {
    Icon: Megaphone,
    title: "Public Awareness & Education",
    text: "Raising awareness about the benefits of renewable energy is a core part of our mission. We conduct outreach programs, publish reports, and leverage media channels to educate businesses, policymakers, and the general public about the potential of clean energy solutions in ensuring energy security and environmental sustainability.",
  },
];

function WhatWeDoCard({
  Icon,
  title,
  text,
  index,
}: (typeof whatWeDo)[number] & { index: number }) {
  return (
    <article className="reveal group relative flex flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-sm transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-1 hover:border-brand-yellow/40 hover:bg-white/[0.07]">
      <div className="flex items-center justify-between">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-yellow/10 text-brand-yellow transition-colors duration-500 group-hover:bg-brand-yellow group-hover:text-brand-navy">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <span className="font-serif text-3xl text-white/15" aria-hidden="true">
          0{index + 1}
        </span>
      </div>
      <h3 className="mt-6 text-lg leading-snug font-semibold text-white">
        {title}
      </h3>
      <p className="mt-3 text-[15px] leading-7 text-white/65">{text}</p>
    </article>
  );
}

/*--A message from a board member: photo with an offset frame, and the text as a quote--*/
function Message({
  title,
  name,
  role,
  photo,
  photoAlt,
  width,
  height,
  reverse,
  children,
}: {
  title: string;
  name: string;
  role: string;
  photo: string;
  photoAlt: string;
  width: number;
  height: number;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Container className="grid items-center gap-12 md:grid-cols-[0.85fr_1.15fr] md:gap-20">
      <div
        className={cn(
          "reveal relative mx-auto w-full max-w-[420px]",
          reverse && "md:order-2",
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 translate-y-5 rounded-[2rem] bg-brand-mint",
            reverse ? "-translate-x-5" : "translate-x-5",
          )}
        />
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-brand-cream to-white shadow-[var(--shadow-lift)]">
          <Image
            src={photo}
            alt={photoAlt}
            width={width}
            height={height}
            className="h-auto w-full"
          />
        </div>
      </div>
      <div className={cn("reveal", reverse && "md:order-1")}>
        <Eyebrow>{title}</Eyebrow>
        <Quote
          className="mt-6 size-10 fill-brand-yellow/20 text-brand-yellow"
          aria-hidden="true"
        />
        <div className="mt-4 space-y-4 text-[16px] leading-8 text-brand-slate">
          {children}
        </div>
        <div className="mt-8 border-l-2 border-brand-yellow pl-4">
          <p className="font-serif text-xl font-semibold text-brand-navy">
            {name}
          </p>
          <p className="text-sm text-brand-gray">{role}</p>
        </div>
      </div>
    </Container>
  );
}

export default function Home() {
  const latest = getPosts().slice(0, 6);
  const memberTabs = getMemberLogos();

  return (
    <>
      <HeroSlideshow />

      {/* Key facts */}
      <section className="relative z-10 -mt-px bg-brand-navy">
        <Container className="grid divide-white/10 border-t border-white/10 sm:grid-cols-3 sm:divide-x">
          {[
            { value: "2011", label: "Advocating for clean energy since" },
            { value: "200+", label: "Active member companies" },
            {
              value: "Solar · Wind · Hydro",
              label: "And energy efficiency, under one voice",
            },
          ].map((fact) => (
            <div
              key={fact.label}
              className="px-2 py-5 text-center sm:px-6 sm:py-8 md:py-10"
            >
              <p className="font-serif text-2xl text-brand-yellow sm:text-3xl md:text-4xl">
                {fact.value}
              </p>
              <p className="mt-2 text-sm text-white/60">{fact.label}</p>
            </div>
          ))}
        </Container>
      </section>

      {/* About us */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <Image
          src="/uploads/2025/04/sun.png"
          alt=""
          width={512}
          height={512}
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 w-[420px] opacity-[0.07] motion-safe:animate-[spin_120s_linear_infinite]"
        />
        <Container className="relative grid gap-12 md:grid-cols-2 md:gap-20">
          <div className="reveal">
            <Eyebrow>About Us</Eyebrow>
            <h2 className="mt-6 text-3xl leading-[1.2] md:text-[44px]">
              Together, we are paving the way for a cleaner, greener energy
              future by empowering the renewable energy industry to thrive.
            </h2>
          </div>
          <div className="reveal space-y-5 text-[16px] leading-8 text-brand-slate md:pt-14">
            <p>
              The Bangladesh Sustainable and Renewable Energy Association
              (BSREA) has been at the forefront of advocating for cleaner,
              greener energy in Bangladesh since 2011. As the largest platform
              for renewable energy stakeholders, BSREA works tirelessly to
              promote sustainable energy solutions, facilitate investments, and
              shape policies that drive the transition to a renewable energy
              future.
            </p>
            <p>
              BSREA serves as a unified voice for{" "}
              <b className="font-semibold text-brand-navy">
                over 200 active members
              </b>
              , including solar power developers, wind energy investors,
              hydropower projects, and energy efficiency providers. Our mission
              is to promote the adoption of renewable energy technologies by
              fostering industry collaboration, facilitating investments, and
              working closely with the government to shape policies that support
              clean energy initiatives.
            </p>
            <ButtonLink href="/about-bsrea" variant="outline" className="mt-4">
              Learn More About BSREA
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* Latest news */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="reveal flex flex-wrap items-end justify-between gap-6">
            <div>
              <Eyebrow>Media Center</Eyebrow>
              <h2 className="mt-4 text-3xl md:text-[44px]">
                Latest News &amp; Events
              </h2>
            </div>
            <Link
              href="/news-and-events"
              className="group inline-flex items-center gap-2 text-sm font-semibold text-brand-green"
            >
              View all news
              <ArrowRight
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {latest.map((post) => (
              <PostCardCompact key={post.id} post={post} />
            ))}
          </div>
        </Container>
      </section>

      {/* Mission & vision */}
      <section className="relative overflow-hidden bg-brand-mint/60 py-20 md:py-28">
        <Image
          src="/uploads/2025/04/green-energy-23.png"
          alt=""
          width={426}
          height={168}
          aria-hidden="true"
          className="pointer-events-none absolute right-6 bottom-6 w-[260px] opacity-[0.12]"
        />
        <Container className="relative">
          <div className="reveal mx-auto max-w-[720px] text-center">
            <Eyebrow>Mission &amp; Vision</Eyebrow>
            <h2 className="mt-5 text-3xl leading-tight md:text-[44px]">
              Driving Bangladesh towards a cleaner, sustainable energy future
              through innovation, collaboration, and advocacy.
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {[
              {
                Icon: Lightbulb,
                title: "Mission",
                text: "Our mission is to accelerate the adoption of renewable energy technologies in Bangladesh, creating an environment that fosters investment, policy development, and strong industry collaboration to ensure energy security and environmental sustainability.",
              },
              {
                Icon: Telescope,
                title: "Vision",
                text: "We envision a future where Bangladesh leads the way in renewable energy, leveraging clean energy solutions to power communities, enhance economic growth, and promote environmental stewardship.",
              },
            ].map(({ Icon, title, text }) => (
              <article
                key={title}
                className="reveal rounded-3xl bg-white p-8 shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] md:p-10"
              >
                <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-yellow/15 text-[#c48f00]">
                  <Icon className="size-7" aria-hidden="true" />
                </span>
                <h3 className="mt-6 font-serif text-3xl font-semibold">
                  {title}
                </h3>
                <p className="mt-4 text-[16px] leading-8 text-brand-slate">
                  {text}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      {/* Messages from the President and the Secretary */}
      <section className="space-y-24 py-20 md:space-y-32 md:py-32">
        <Message
          title="Message from the President"
          name="Mostafa Al Mahmud"
          role="President, BSREA"
          photo="/uploads/2026/02/presi.png"
          photoAlt="Mostafa Al Mahmud, President of BSREA"
          width={465}
          height={593}
        >
          <p>
            It is with great pride and enthusiasm that I welcome you to the
            Bangladesh Sustainable and Renewable Energy Association (BSREA).
            Since our establishment in 2011, BSREA has been at the forefront of
            advocating for a cleaner, greener future for Bangladesh. As the
            largest platform for businesses and organizations working in the
            renewable energy sector, we remain steadfast in our mission to
            promote sustainable energy solutions, drive policy reforms, and
            create a conducive business environment for industry stakeholders.
          </p>
          <p>
            Renewable energy is not just a necessity—it is the future.
            Bangladesh has immense potential to harness solar, wind, and other
            clean energy sources to meet its growing energy demands sustainably.
            At BSREA, we are committed to fostering industry growth,
            facilitating investment, and working hand in hand with the
            government and development partners to make renewable energy the
            cornerstone of our national energy strategy.
          </p>
          <p>
            I encourage all stakeholders, businesses, policymakers, and citizens
            to join us in our efforts to build a sustainable and energy-secure
            Bangladesh. Together, we can make a lasting impact.
          </p>
        </Message>
        <Message
          title="Message from the Secretary"
          name="Engr. Mohammad Ataur Rahman Sarker"
          role="General Secretary, BSREA"
          photo="/uploads/2026/02/GS.png"
          photoAlt="Engr. Mohammad Ataur Rahman Sarker, General Secretary of BSREA"
          width={452}
          height={568}
          reverse
        >
          <p>
            Welcome to BSREA, the leading voice of the renewable energy sector
            in Bangladesh. Our association has been instrumental in shaping
            policies, strengthening industry collaborations, and ensuring that
            renewable energy solutions are accessible and viable for businesses
            and communities across the country.
          </p>
          <p>
            The transition to clean energy is a journey that requires strong
            partnerships, innovation, and unwavering commitment. BSREA continues
            to play a key role in bridging the gap between industry needs and
            policy development, advocating for financial incentives,
            technological advancements, and public awareness.
          </p>
          <p>
            As we look ahead, our goal is to further expand our impact by
            supporting more projects, facilitating greater investments, and
            working closely with our members to address challenges in the
            renewable energy landscape. We invite all stakeholders to
            collaborate with us as we strive for a cleaner, more sustainable
            Bangladesh.
          </p>
          <p>Thank you for being a part of this journey.</p>
        </Message>
      </section>

      {/* Our commitment + what we do */}
      <section className="relative isolate overflow-hidden bg-brand-navy py-24 md:py-32">
        <div
          aria-hidden="true"
          className="absolute -top-40 left-1/4 -z-10 size-[520px] rounded-full bg-brand-green/25 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="absolute right-0 bottom-0 -z-10 size-[420px] rounded-full bg-brand-yellow/10 blur-[120px]"
        />
        <Container>
          <div className="reveal mx-auto max-w-[900px] text-center">
            <Eyebrow light>Our Commitment</Eyebrow>
            <p className="mt-8 font-serif text-2xl leading-[1.5] text-white md:text-[34px]">
              BSREA is committed to creating a future where renewable energy
              plays a pivotal role in Bangladesh’s energy mix. We believe in
              fostering innovation, building strong partnerships, and advocating
              for policies that drive sustainable growth in the clean energy
              sector.
            </p>
            <p className="mx-auto mt-6 max-w-[720px] text-[16px] leading-8 text-white/60">
              By working together with businesses, government institutions, and
              development partners, we strive to make Bangladesh a model for
              renewable energy development in South Asia.
            </p>
          </div>

          <div className="mt-24 md:mt-32">
            <div className="reveal max-w-[720px]">
              <Eyebrow light>What We Do</Eyebrow>
              <p className="mt-5 text-[16px] leading-8 text-white/70">
                BSREA is dedicated to advancing Bangladesh’s transition to
                sustainable energy. We work with government bodies, businesses,
                and partners to promote renewable energy solutions, advocate for
                supportive policies, and foster industry growth. Our efforts
                include policy advocacy, industry development, financial
                partnerships, research, and public awareness, ensuring clean
                energy becomes a key part of Bangladesh’s energy strategy.
              </p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {whatWeDo.map((item, index) => (
                <WhatWeDoCard key={item.title} {...item} index={index} />
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Video */}
      <section className="py-20 md:py-28">
        <Container className="max-w-[1040px]">
          <div className="reveal text-center">
            <Eyebrow>Watch</Eyebrow>
            <h2 className="mt-4 text-3xl md:text-[44px]">BSREA in action</h2>
          </div>
          <YouTubeEmbed
            url="https://youtu.be/9_uUuDVurYw"
            title="BSREA"
            className="reveal mt-10 rounded-3xl shadow-[var(--shadow-lift)]"
          />
        </Container>
      </section>

      {/* Our members */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="reveal text-center">
            <Eyebrow>Our Members</Eyebrow>
            <h2 className="mt-4 text-3xl md:text-[44px]">
              Trusted by the industry
            </h2>
          </div>
          <div className="mt-10">
            <MemberLogos tabs={memberTabs} />
          </div>
        </Container>
      </section>

      {/* Become a member */}
      <JoinCta
        title="Become a Member"
        text="Join the Bangladesh Sustainable and Renewable Energy Association (BSREA) and be part of the renewable energy movement in Bangladesh. Take action today—together, we can power a sustainable future."
        href="/eligibility-membership-form"
        button="Join Now"
      />
    </>
  );
}
