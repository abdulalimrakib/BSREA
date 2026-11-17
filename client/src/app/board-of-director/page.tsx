import type { Metadata } from "next";
import Image from "next/image";
import { PageBanner, Section, SectionHeading } from "@/components/site/blocks";
import { getBoard, type BoardMember } from "@/lib/content";

export const metadata: Metadata = { title: "Board of Director" };

function PersonCard({ person }: { person: BoardMember }) {
  return (
    <article className="reveal group flex w-full flex-col overflow-hidden rounded-3xl border border-brand-navy/5 bg-white shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] sm:w-[calc(50%-12px)] lg:w-[calc(25%-18px)]">
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-b from-brand-cream to-brand-mist">
        {person.photo && (
          <Image
            src={person.photo}
            alt={person.name}
            fill
            sizes="(min-width: 1024px) 270px, (min-width: 640px) 50vw, 100vw"
            className="object-cover object-top transition-transform duration-700 ease-[var(--ease-smooth)] group-hover:scale-[1.04]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col items-center px-5 pt-5 pb-6 text-center">
        <p className="rounded-full bg-brand-mint px-3 py-1 text-xs font-semibold text-brand-green">
          {person.position}
        </p>
        <h3 className="mt-3 font-serif text-xl leading-snug font-semibold text-brand-navy">
          {person.name}
        </h3>
        <p className="mt-2 text-sm text-brand-slate">{person.designation}</p>
        <p className="mt-0.5 text-sm font-medium text-brand-navy">
          {person.company}
        </p>
      </div>
    </article>
  );
}

export default function BoardPage() {
  const rows = getBoard();
  return (
    <>
      <PageBanner
        title="Board of Director"
        image="/uploads/2025/05/cf937517-3e28-4d93-aaef-4f952b180f68-scaled.jpg"
        position="center 30%"
      />
      <Section>
        <SectionHeading
          eyebrow="Executive Committee 2025-26"
          title="Bangladesh Sustainable and Renewable Energy Association (BSREA)"
          center
        />
        <div className="mt-14 space-y-6">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-wrap justify-center gap-6">
              {row.map((person) => (
                <PersonCard key={person.name} person={person} />
              ))}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
