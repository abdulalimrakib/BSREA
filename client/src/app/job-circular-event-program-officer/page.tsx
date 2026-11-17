import type { Metadata } from "next";
import Image from "next/image";
import { Container, PageHeader, RichText } from "@/components/site/blocks";
import jobCircular from "@/content/job-circular.json";

export const metadata: Metadata = {
  title: "Job Circular – Event & Program Officer",
  description:
    "BSREA is hiring an Event & Program Officer in Dhaka. Full-time, BDT 30,000–40,000 per month.",
};

export default function JobCircularPage() {
  return (
    <>
      <PageHeader
        eyebrow="Careers"
        title="Job Circular – Event & Program Officer"
      />
      <section className="pb-16 md:pb-24">
        <Container className="max-w-[860px]">
          <Image
            src="/uploads/2026/08/RENEWABLE-ENERGY-SOLUTIONS-1024x576-1.jpg"
            alt="Renewable energy solutions"
            width={1024}
            height={576}
            priority
            className="-mt-4 h-auto w-full rounded-3xl shadow-[var(--shadow-lift)]"
          />
          <RichText
            html={jobCircular.html}
            className="mx-auto mt-12 max-w-[720px]"
          />
        </Container>
      </section>
    </>
  );
}
