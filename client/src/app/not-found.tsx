import Link from "next/link";
import { ButtonLink, Container } from "@/components/site/blocks";
import { mainMenu } from "@/lib/site";

export default function NotFound() {
  const links = mainMenu.flatMap((item) =>
    item.children
      ? item.children
      : item.href
        ? [{ label: item.label, href: item.href }]
        : [],
  );
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-brand-mint/70 to-brand-snow py-24 md:py-32">
      <div
        aria-hidden="true"
        className="absolute -top-32 right-[-10%] -z-10 size-[420px] rounded-full bg-brand-yellow/15 blur-[100px]"
      />
      <Container className="max-w-[760px] text-center">
        <p
          className="font-serif text-[120px] leading-none text-brand-green/15 md:text-[180px]"
          aria-hidden="true"
        >
          404
        </p>
        <h1 className="-mt-6 text-4xl md:text-5xl">Page not found</h1>
        <p className="mt-4 text-lg text-brand-slate">
          The page you are looking for may have moved. Try one of these instead:
        </p>
        <ul className="mt-10 flex flex-wrap justify-center gap-2 text-sm">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-block rounded-full border border-brand-navy/10 bg-white px-4 py-2 text-brand-navy transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-green hover:text-brand-green"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <ButtonLink href="/" className="mt-10">
          Back to Home
        </ButtonLink>
      </Container>
    </section>
  );
}
