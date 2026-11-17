import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import {
  Container,
  PageBanner,
  SectionHeading,
} from "@/components/site/blocks";

export const metadata: Metadata = {
  title: "National Database of Renewable Energy",
};

/*--Links into SREDA's National Database of Renewable Energy (ndre.sreda.gov.bd)--*/
const NDRE = "https://ndre.sreda.gov.bd/index.php";

type LinkItem = { label: string; href: string; children?: LinkItem[] };

// Technology codes NDRE uses in its "i" parameter
const technologies: {
  label: string;
  i: number;
  children?: { label: string; i: number }[];
}[] = [
  {
    label: "Solar",
    i: 17,
    children: [
      { label: "Solar Park", i: 1 },
      { label: "Rooftop Solar Except NEM", i: 2 },
      { label: "Net Metering Rooftop Solar", i: 3 },
      { label: "Solar Irrigation", i: 4 },
      { label: "Solar Minigrid", i: 5 },
      { label: "Solar Microgrid", i: 6 },
      { label: "Solar Nanogrid", i: 7 },
      { label: "Solar Charging Station", i: 8 },
      { label: "Solar Powered Telecom BTS", i: 9 },
      { label: "Solar Drinking Water System", i: 10 },
    ],
  },
  { label: "Wind", i: 11 },
  { label: "Hydro", i: 12 },
  {
    label: "Biogas",
    i: 13,
    children: [{ label: "Biogas to Electricity", i: 14 }],
  },
  {
    label: "Biomass",
    i: 15,
    children: [{ label: "Biomass to Electricity", i: 16 }],
  },
];

const byTechnology = (id: number): LinkItem[] =>
  technologies.map((t) => ({
    label: t.label,
    href: `${NDRE}?id=${id}&i=${t.i}`,
    children: t.children?.map((c) => ({
      label: c.label,
      href: `${NDRE}?id=${id}&i=${c.i}`,
    })),
  }));

const sections: { title: string; links: LinkItem[] }[] = [
  {
    title: "Reports",
    links: [
      { label: "Electricity Generation Mix", href: `${NDRE}?id=7` },
      { label: "RE Generation Summary Report", href: `${NDRE}?id=4` },
      { label: "RE Progress in Line Graph", href: `${NDRE}?id=23` },
      { label: "RE Generation Records", href: `${NDRE}?id=22` },
      { label: "Technology wise Generation", href: `${NDRE}?id=8` },
      {
        label: "Year wise Generation of Large Projects",
        href: `${NDRE}?id=11`,
      },
      {
        label: "Year wise Generation of Small Projects",
        href: `${NDRE}?id=12`,
      },
      { label: "Energy Generation and Carbon Savings", href: `${NDRE}?id=21` },
      {
        label: "Net Metering Summary Records",
        href: "https://solar.sreda.gov.bd/nem/nemstatistics.php",
      },
      {
        label: "Statistics of Net Metered Rooftop Solar",
        href: `${NDRE}?id=17`,
      },
      { label: "Statistics of Solar Irrigation Pumps", href: `${NDRE}?id=15` },
      { label: "Statistics of Solar Parks", href: `${NDRE}?id=16` },
      { label: "Statistics of Solar Charging Station", href: `${NDRE}?id=18` },
      {
        label: "Statistics of Solar Powered Telecom BTS",
        href: `${NDRE}?id=19`,
      },
      {
        label: "Statistics of Solar Drinking Water System",
        href: `${NDRE}?id=20`,
      },
      { label: "Search Project", href: `${NDRE}?id=10` },
    ],
  },
  { title: "RE Large Projects", links: byTechnology(1) },
  {
    title: "RE Small Projects",
    links: [
      {
        label: "RE Small Projects",
        href: `${NDRE}?id=2`,
        children: [
          { label: "Solar Home System", href: `${NDRE}?id=2&i=1` },
          { label: "Solar Street Light", href: `${NDRE}?id=2&i=3` },
          { label: "Solar Water Heater", href: `${NDRE}?id=2&i=2` },
          { label: "Biogas Plant", href: `${NDRE}?id=2&i=6` },
        ],
      },
    ],
  },
  { title: "RE Large Projects on Map", links: byTechnology(3) },
  {
    title: "RE Stakeholder",
    links: [
      {
        label: "RE Stakeholder List",
        href: "https://solar.sreda.gov.bd/stakeholder/view/",
      },
      {
        label: "Invitation List in English",
        href: "https://solar.sreda.gov.bd/stakeholder/view/index.php?id=01",
      },
      {
        label: "Invitation List in Bangla",
        href: "https://solar.sreda.gov.bd/stakeholder/view/index.php?id=03",
      },
      {
        label: "Stakeholder Management",
        href: "https://solar.sreda.gov.bd/stakeholder/login/",
      },
    ],
  },
  { title: "Sub-district wise", links: byTechnology(5) },
  {
    title: "NEM Program",
    links: [
      {
        label: "Calculator: Initial Assessment of Net Metered Rooftop Solar",
        href: "https://nemcalc.sreda.gov.bd/",
      },
      {
        label: "Summary Records of Net Metering Program",
        href: "https://solar.sreda.gov.bd/nem/nemstatistics.php",
      },
      {
        label: "Distribution Utilitywise Summary of Net Metered Rooftop Solar",
        href: `${NDRE}?id=17`,
      },
      {
        label: "Full List of Net Metered Rooftop Solar Projects",
        href: `${NDRE}?id=1&i=3`,
      },
      {
        label: "Financing Statistics of Last-Mile Financial Distributors",
        href: `${NDRE}?id=24&i=3`,
      },
      {
        label: "Statistics of RESCO/OPEX investors",
        href: `${NDRE}?id=25&i=3`,
      },
      { label: "Statistics of EPC companies", href: `${NDRE}?id=26&i=3` },
      { label: "NEM Project Owners: Organization", href: `${NDRE}?id=29&i=3` },
      {
        label: "NEM Project Owners: Individual Person",
        href: `${NDRE}?id=30&i=3`,
      },
      {
        label: "Districtwise Progress of Net Metered Projects",
        href: `${NDRE}?id=27&i=3`,
      },
      { label: "Classwise Net Metered Projects", href: `${NDRE}?id=28&i=3` },
    ],
  },
];

const capacity = [
  {
    technology: "Solar",
    offGrid: "377.15",
    onGrid: "909.16",
    total: "1286.31",
  },
  { technology: "Wind", offGrid: "2", onGrid: "60.9", total: "62.9" },
  { technology: "Hydro", offGrid: "0", onGrid: "230", total: "230" },
  {
    technology: "Biogas to Electricity",
    offGrid: "0.69",
    onGrid: "0",
    total: "0.69",
  },
  {
    technology: "Biomass to Electricity",
    offGrid: "0.4",
    onGrid: "0",
    total: "0.4",
  },
];

function LinkList({ links }: { links: LinkItem[] }) {
  return (
    <ul className="space-y-1.5">
      {links.map((link) => (
        <li key={link.href + link.label}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-start gap-2 text-sm text-brand-slate transition-colors hover:text-brand-green"
          >
            <ExternalLink
              className="mt-0.5 size-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
            <span
              className={
                link.children ? "font-semibold text-brand-navy" : undefined
              }
            >
              {link.label}
            </span>
          </a>
          {link.children && (
            <div className="mt-1.5 ml-5">
              <LinkList links={link.children} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function NationalDatabasePage() {
  return (
    <>
      <PageBanner
        title="National Database of Renewable Energy"
        image="/uploads/2025/05/solar-farm-on-greenery-tree-in-the-village-provide-2024-10-18-03-54-16-utc-1-1024x683.jpg"
      />

      <section className="py-16 md:py-24">
        <Container className="max-w-[960px]">
          <SectionHeading
            eyebrow="SREDA data"
            title="Installed Renewable Energy Capacity"
            className="mb-10"
          />
          <div className="reveal overflow-x-auto rounded-3xl border border-brand-navy/5 bg-white shadow-[var(--shadow-soft)]">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-mist/70 text-brand-navy">
                  {[
                    "Technology",
                    "Off-grid (MW)",
                    "On-grid (MW)",
                    "Total (MW)",
                  ].map((head) => (
                    <th
                      key={head}
                      scope="col"
                      className="px-5 py-4 text-left text-xs font-semibold tracking-[0.12em] uppercase"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {capacity.map((row) => (
                  <tr
                    key={row.technology}
                    className="border-t border-brand-navy/5 transition-colors hover:bg-brand-mint/40"
                  >
                    <td className="px-5 py-3.5 font-medium text-brand-navy">
                      {row.technology}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums">{row.offGrid}</td>
                    <td className="px-5 py-3.5 tabular-nums">{row.onGrid}</td>
                    <td className="px-5 py-3.5 font-medium tabular-nums text-brand-navy">
                      {row.total}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-brand-green/20 bg-brand-mint/50 font-semibold text-brand-navy">
                  <td className="px-5 py-4">Total</td>
                  <td className="px-5 py-4 tabular-nums">380.24</td>
                  <td className="px-5 py-4 tabular-nums">1200.06</td>
                  <td className="px-5 py-4 tabular-nums text-brand-green">
                    1580.3
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-brand-gray">
            Source:{" "}
            <a
              href="https://ndre.sreda.gov.bd/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-brand-green"
            >
              SREDA – National Database of Renewable Energy
            </a>
          </p>
        </Container>
      </section>

      <section className="pb-16 md:pb-24">
        <Container className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <div
              key={section.title}
              className="reveal rounded-3xl border border-brand-navy/5 bg-white p-7 shadow-[var(--shadow-soft)]"
            >
              <h2 className="mb-5 border-b border-brand-navy/10 pb-3 text-2xl">
                {section.title}
              </h2>
              <LinkList links={section.links} />
            </div>
          ))}
        </Container>
      </section>
    </>
  );
}
