import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2, FileDown } from "lucide-react";
import {
  ButtonLink,
  Container,
  Eyebrow,
  PageBanner,
  prose,
  Section,
  SectionHeading,
} from "@/components/site/blocks";

export const metadata: Metadata = { title: "Eligibility & Membership Form" };

const reasons = [
  "Be part of Bangladesh’s most influential renewable energy network",
  "Access exclusive networking, advocacy, and partnership opportunities",
  "Gain visibility and recognition within the renewable energy sector",
  "Participate in events, training, seminars, and industry development initiatives",
  "Contribute to shaping policies and the future of clean energy in Bangladesh",
];

const documents = [
  "Completed Membership Application Form",
  "Copy of Trade License",
  "Tax Submission Acknowledgement (both Company & Applicant)",
  "Business Identification Number (BIN) Certificate",
  "Memorandum and Articles of Association (for companies)",
  "Certificate of Incorporation",
  "Any other relevant certificates (if applicable)",
  "National ID (NID) or Passport (Applicant and Contact Person)",
  "Visiting Card (Applicant and Contact Person)",
  "Three (3) copies of Passport Size Photos (Applicant and Contact Person)",
  "Pay Order or Fund Transfer Receipt (copy)",
];

export default function EligibilityPage() {
  return (
    <>
      <PageBanner
        title="Eligibility & Membership Form"
        image="/uploads/2025/04/acceptance-of-new-members-into-the-ranks-.jpg"
      />

      <section className="py-16 md:py-24">
        <Container className="grid items-center gap-12 md:grid-cols-2 md:gap-20">
          <div className="reveal grid grid-cols-2 gap-3">
            <div className="space-y-3">
              <Image
                src="/uploads/2026/03/2-scaled.jpg"
                alt="BSREA event"
                width={1920}
                height={1161}
                className="h-auto w-full rounded-2xl object-cover shadow-[var(--shadow-soft)]"
              />
              <Image
                src="/uploads/2026/03/3-1024x664.jpg"
                alt="BSREA event"
                width={1024}
                height={664}
                className="h-auto w-full rounded-2xl object-cover shadow-[var(--shadow-soft)]"
              />
            </div>
            <div className="space-y-3 pt-8">
              <Image
                src="/uploads/2026/03/1-scaled.jpg"
                alt="BSREA event"
                width={2560}
                height={1021}
                className="h-auto w-full rounded-2xl object-cover shadow-[var(--shadow-soft)]"
              />
              <Image
                src="/uploads/2026/03/4-1024x697.jpg"
                alt="BSREA event"
                width={1024}
                height={697}
                className="h-auto w-full rounded-2xl object-cover shadow-[var(--shadow-soft)]"
              />
            </div>
          </div>
          <div className="reveal">
            <Eyebrow>Membership</Eyebrow>
            <h2 className="mt-4 text-3xl leading-tight md:text-[44px]">
              Become a Member of BSREA
            </h2>
            <p className={`mt-6 ${prose}`}>
              Joining the Bangladesh Sustainable and Renewable Energy
              Association (BSREA) means becoming part of Bangladesh’s largest
              platform for clean energy advocacy, innovation, and collaboration.
              As a member, you will have the opportunity to contribute to
              shaping the future of renewable energy in Bangladesh, expand your
              professional network, and access valuable industry insights and
              resources.
            </p>
            <ButtonLink
              href="/membership/apply"
              variant="green"
              className="mt-8"
            >
              Apply Online
            </ButtonLink>
          </div>
        </Container>
      </section>

      <Section tone="navy">
        <SectionHeading
          eyebrow="Benefits"
          title="Why Join BSREA?"
          center
          light
        />
        <div className="mt-12 flex flex-wrap justify-center gap-5">
          {reasons.map((reason, index) => (
            <div
              key={reason}
              className="reveal flex w-full flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-1 hover:border-brand-yellow/40 sm:w-[calc(50%-10px)] lg:w-[calc(20%-16px)]"
            >
              <span className="font-serif text-3xl text-brand-yellow">
                0{index + 1}
              </span>
              <p className="text-[15px] leading-7 text-white/80">{reason}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section containerClassName="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
        <div>
          <SectionHeading
            eyebrow="Requirements"
            title="Membership Requirements"
            intro={
              <p>
                To apply for membership, please prepare and submit the following
                documents along with your application form:
              </p>
            }
          />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {documents.map((doc) => (
              <li
                key={doc}
                className="reveal flex gap-3 rounded-2xl border border-brand-navy/5 bg-white p-4 text-[15px] leading-6 text-brand-slate shadow-[var(--shadow-soft)]"
              >
                <CheckCircle2
                  className="mt-0.5 size-5 shrink-0 text-brand-green"
                  aria-hidden="true"
                />
                {doc}
              </li>
            ))}
          </ul>
        </div>
        <aside className="reveal space-y-5 self-start lg:sticky lg:top-28">
          <div className="relative isolate overflow-hidden rounded-[2rem] bg-brand-navy p-8 text-white">
            <div
              aria-hidden="true"
              className="absolute -top-20 -right-20 -z-10 size-60 rounded-full bg-brand-green/40 blur-3xl"
            />
            <h3 className="font-serif text-2xl font-semibold text-white">
              Apply online
            </h3>
            <p className="mt-2 text-[15px] leading-7 text-white/70">
              Fill in the form and upload your documents on this website. No
              printing needed.
            </p>
            <ButtonLink href="/membership/apply" className="mt-6">
              Apply Online
            </ButtonLink>
          </div>
          <div className="rounded-[2rem] border border-brand-navy/5 bg-white p-8 shadow-[var(--shadow-soft)]">
            <h3 className="font-serif text-xl font-semibold">
              Or download the paper form
            </h3>
            <div className="mt-5 grid gap-3">
              {[
                {
                  label: "Download Word file",
                  href: "/uploads/2024/03/BSREA-New-Membership-Application-Form-Word.docx",
                },
                {
                  label: "Download PDF file",
                  href: "/uploads/2024/03/BSREA-New-Membership-Application-Form.pdf",
                },
              ].map((file) => (
                <a
                  key={file.href}
                  href={file.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-xl border border-brand-navy/10 px-4 py-3 text-sm font-medium text-brand-navy transition-colors hover:border-brand-green hover:text-brand-green"
                >
                  <FileDown
                    className="size-4 text-brand-green"
                    aria-hidden="true"
                  />{" "}
                  {file.label}
                </a>
              ))}
            </div>
          </div>
        </aside>
      </Section>

      <Section tone="white">
        <SectionHeading eyebrow="Fees" title="Membership fees" center />
        <div className="reveal mx-auto mt-10 max-w-[1000px] overflow-hidden rounded-3xl border border-brand-navy/5 bg-white p-4 shadow-[var(--shadow-soft)] sm:p-8">
          <Image
            src="/uploads/2026/03/fee@2x-1024x322.png"
            alt="BSREA membership fee chart"
            width={1024}
            height={322}
            className="mx-auto h-auto w-full"
          />
        </div>
        <p className="mt-6 text-center text-sm font-medium text-brand-gray">
          Note: All fees are exclusive of VAT and TAX.
        </p>
      </Section>
    </>
  );
}
