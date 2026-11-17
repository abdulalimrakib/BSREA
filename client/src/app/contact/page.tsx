import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import ContactForm from "@/components/contact/contact-form";
import {
  Container,
  PageBanner,
  SectionHeading,
} from "@/components/site/blocks";
import SocialIcon from "@/components/site/social-icon";
import { site, socials, telHref } from "@/lib/site";
import { panelClass } from "@/lib/styles";

export const metadata: Metadata = { title: "Contact" };

const details = [
  { Icon: Phone, label: "Phone", value: site.phone, href: telHref(site.phone) },
  {
    Icon: MessageCircle,
    label: "WhatsApp",
    value: site.whatsapp,
    href: telHref(site.whatsapp),
  },
  {
    Icon: Mail,
    label: "Email",
    value: site.email,
    href: `mailto:${site.email}`,
  },
];

export default function ContactPage() {
  return (
    <>
      <PageBanner
        title="Contact"
        image="/uploads/2025/04/renewable-energy-generation.jpg"
      />

      <section className="py-16 md:py-24">
        <Container className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="Get in touch"
              title="We would love to speak with you"
              intro={
                <p>
                  Feel free to reach out using the details below, or send us a
                  message.
                </p>
              }
            />
            <ul className="mt-10 space-y-3">
              {details.map(({ Icon, label, value, href }) => (
                <li key={label} className="reveal">
                  <a
                    href={href}
                    className="group flex items-center gap-4 rounded-2xl border border-brand-navy/5 bg-white p-4 shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-0.5 hover:border-brand-green/30"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-mint text-brand-green transition-colors duration-500 group-hover:bg-brand-green group-hover:text-white">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-xs font-semibold tracking-[0.15em] text-brand-gray uppercase">
                        {label}
                      </span>
                      <span className="block font-medium break-all text-brand-navy">
                        {value}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
              <li className="reveal flex items-start gap-4 rounded-2xl border border-brand-navy/5 bg-white p-4 shadow-[var(--shadow-soft)]">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-mint text-brand-green">
                  <MapPin className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-xs font-semibold tracking-[0.15em] text-brand-gray uppercase">
                    Office
                  </span>
                  <address className="font-medium text-brand-navy not-italic">
                    {site.address}
                  </address>
                </span>
              </li>
            </ul>
            <div className="reveal mt-8 flex items-center gap-3">
              <span className="text-xs font-semibold tracking-[0.2em] text-brand-gray uppercase">
                Follow us
              </span>
              {socials.map((s) => (
                <a
                  key={s.network}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex size-10 items-center justify-center rounded-full border border-brand-navy/10 text-brand-navy transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-green hover:text-brand-green"
                >
                  <SocialIcon network={s.network} className="size-4" />
                </a>
              ))}
            </div>
          </div>

          <div className={`reveal self-start ${panelClass}`}>
            <h2 className="text-2xl md:text-3xl">Send us a message</h2>
            <p className="mt-2 mb-8 text-[15px] text-brand-slate">
              Fill out the form below and we will contact you as soon as
              possible.
            </p>
            <ContactForm />
          </div>
        </Container>
      </section>

      <section className="pb-16 md:pb-24">
        <Container>
          <div className="reveal overflow-hidden rounded-[2rem] border border-brand-navy/5 shadow-[var(--shadow-lift)]">
            <iframe
              title="BSREA office location on Google Maps"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&t=m&z=16&output=embed&iwloc=near`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block h-[360px] w-full border-0 md:h-[460px]"
            />
          </div>
        </Container>
      </section>
    </>
  );
}
