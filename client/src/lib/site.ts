/*--Site-wide settings: name, contact details, social links and the main menu--*/
// Copied from https://bsreabd.org. Change them here and the header, footer and contact page follow.

/*--Demo mode: the copy of this website running on a personal demo server (not the official site).
    Built with NEXT_PUBLIC_DEMO_MODE=1, it shows a "not the official website" banner on every page,
    asks search engines not to list it, and marks the forms as demo only.--*/
export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
export const officialUrl = "https://bsreabd.org";

export const site = {
  name: "BSREA",
  fullName: "Bangladesh Sustainable and Renewable Energy Association",
  title: "The Bangladesh Sustainable and Renewable Energy Association",
  tagline: "Leading the Transformation to a Clean Energy Economy",
  url: process.env.NEXT_PUBLIC_SITE_URL || officialUrl,
  address: "Suite # 21/B, Navana Tower, 45, Gulshan South Avenue (Circle-1), Dhaka-1212, Bangladesh.",
  addressLines: ["Suite # 21/B, Navana Tower,", "45, Gulshan South Avenue (Circle-1),", "Dhaka-1212, Bangladesh."],
  whatsapp: "+88 01727037440",
  phone: "+880 9647-200500",
  email: "bsrea.bd@gmail.com",
  mapQuery: "Navana Tower, 45 Gulshan South Avenue, Dhaka 1212",
  logo: "/uploads/2026/02/logo-web.png",
  footerLogo: "/uploads/2025/04/Asset-5@0.5x.png",
} as const;

export type SocialNetwork = "facebook" | "linkedin" | "youtube";

export const socials: { network: SocialNetwork; label: string; href: string }[] = [
  { network: "facebook", label: "Facebook", href: "https://www.facebook.com/share/15vEY5J5Wu/" },
  { network: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/company/bsrea/" },
  { network: "youtube", label: "YouTube", href: "https://www.youtube.com/channel/UCgRX8W90DGmryoBKPS1fe3g" },
];

export type NavItem = { label: string; href?: string; children?: { label: string; href: string }[] };

export const mainMenu: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "About",
    href: "/about-bsrea",
    children: [
      { label: "Mission & Vision", href: "/mission-vision" },
      { label: "Our Projects", href: "/projects" },
      { label: "Member Welfare", href: "/member-welfare" },
      { label: "CSR", href: "/csr" },
    ],
  },
  {
    label: "Membership",
    children: [
      { label: "Member Directory", href: "/member-directory" },
      { label: "Eligibility & Membership Form", href: "/eligibility-membership-form" },
      { label: "Apply Online", href: "/membership/apply" },
      { label: "Verify a Certificate", href: "/verify" },
    ],
  },
  {
    label: "Governance",
    children: [
      { label: "Board of Director", href: "/board-of-director" },
      { label: "Management", href: "/management" },
    ],
  },
  {
    label: "Media Center",
    children: [
      { label: "News and Events", href: "/news-and-events" },
      { label: "Gallery", href: "/gallery" },
      { label: "Publications", href: "/publications" },
      { label: "Information", href: "/national-database-of-renewable-energy" },
    ],
  },
  { label: "Contact", href: "/contact" },
];

/*--Turn "+88 01727037440" into "tel:+8801727037440"--*/
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
