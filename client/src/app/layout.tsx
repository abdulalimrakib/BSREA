import type React from "react";
import type { Metadata, Viewport } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import SiteHeader from "@/components/site/site-header";
import SiteFooter from "@/components/site/site-footer";
import ScrollToTop from "@/components/site/scroll-to-top";
import DemoBanner from "@/components/site/demo-banner";
import { demoMode, site } from "@/lib/site";

// Text: Plus Jakarta Sans (clean, modern). Headings: Playfair Display (classic serif).
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--ff-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--ff-playfair",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: `%s – ${site.title}` },
  description:
    "BSREA is the largest platform for businesses and organizations driving the clean energy revolution in Bangladesh, advocating for renewable energy since 2011.",
  icons: { icon: "/uploads/2026/02/logo-web.png" },
  openGraph: { siteName: site.title, type: "website" },
  ...(demoMode ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#097834",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${playfair.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg"
        >
          Skip to content
        </a>
        <DemoBanner />
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <ScrollToTop />
        <Toaster richColors />
      </body>
    </html>
  );
}
