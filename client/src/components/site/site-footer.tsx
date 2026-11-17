import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { site, socials, telHref } from "@/lib/site";
import SocialIcon from "@/components/site/social-icon";

const explore = [
  { label: "About BSREA", href: "/about-bsrea" },
  { label: "Mission & Vision", href: "/mission-vision" },
  { label: "Board of Director", href: "/board-of-director" },
  { label: "News and Events", href: "/news-and-events" },
  { label: "Gallery", href: "/gallery" },
  { label: "Publications", href: "/publications" },
];

const membership = [
  { label: "Member Directory", href: "/member-directory" },
  { label: "Eligibility & Membership", href: "/eligibility-membership-form" },
  { label: "Apply Online", href: "/membership/apply" },
  { label: "Verify a Certificate", href: "/verify" },
  { label: "Contact", href: "/contact" },
];

function LinkList({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h2 className="font-sans text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
        {title}
      </h2>
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-[15px] text-white/75 transition-colors duration-200 hover:text-brand-yellow"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-[#13202f] text-white">
      <div
        aria-hidden="true"
        className="absolute -top-48 -left-32 -z-10 size-[480px] rounded-full bg-brand-green/20 blur-[120px]"
      />
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 pt-16 pb-12 sm:px-6 md:grid-cols-2 md:pt-20 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Link href="/" aria-label={site.title} className="inline-block">
            <Image
              src={site.footerLogo}
              alt={site.title}
              width={240}
              height={180}
              className="h-auto w-[200px]"
            />
          </Link>
          <p className="mt-8 max-w-sm font-serif text-2xl leading-snug text-white">
            Leading the <em className="text-brand-yellow">transformation</em> to
            a clean energy economy
          </p>
          <div className="mt-8 flex gap-2">
            {socials.map((s) => (
              <a
                key={s.network}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex size-10 items-center justify-center rounded-full border border-white/10 text-white/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-yellow hover:text-brand-yellow"
              >
                <SocialIcon network={s.network} className="size-4" />
              </a>
            ))}
          </div>
        </div>

        <LinkList title="Explore" links={explore} />
        <LinkList title="Membership" links={membership} />

        <div>
          <h2 className="font-sans text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
            Get in touch
          </h2>
          <ul className="mt-5 space-y-4 text-[15px] text-white/75">
            <li className="flex gap-3">
              <MapPin
                className="mt-1 size-4 shrink-0 text-brand-yellow"
                aria-hidden="true"
              />
              <address className="not-italic">
                {site.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </li>
            <li>
              <a
                href={telHref(site.phone)}
                className="flex items-center gap-3 transition-colors hover:text-brand-yellow"
              >
                <Phone
                  className="size-4 shrink-0 text-brand-yellow"
                  aria-hidden="true"
                />{" "}
                {site.phone}
              </a>
            </li>
            <li>
              <a
                href={telHref(site.whatsapp)}
                className="flex items-center gap-3 transition-colors hover:text-brand-yellow"
              >
                <MessageCircle
                  className="size-4 shrink-0 text-brand-yellow"
                  aria-hidden="true"
                />{" "}
                WhatsApp {site.whatsapp}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${site.email}`}
                className="flex items-center gap-3 break-all transition-colors hover:text-brand-yellow"
              >
                <Mail
                  className="size-4 shrink-0 text-brand-yellow"
                  aria-hidden="true"
                />{" "}
                {site.email}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-5 py-6 text-sm text-white/40 sm:flex-row sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {site.fullName}
          </p>
          <p>Dhaka, Bangladesh</p>
        </div>
      </div>
    </footer>
  );
}
