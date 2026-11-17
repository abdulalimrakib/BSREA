import type { NextConfig } from "next";

// Empty in production: the API is served under /api on the same website, which 'self' already allows.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
const isDev = process.env.NODE_ENV === "development";

/*--Browser security headers for every page of the public site.
  The Content-Security-Policy lists the only places the page may load from: this site, the API,
  YouTube (videos and thumbnails) and Google Maps (contact page). Anything injected from elsewhere is blocked.--*/
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://i.ytimg.com",
      "font-src 'self'",
      `connect-src 'self'${API_URL ? ` ${API_URL}` : ""}`,
      "frame-src https://www.youtube-nocookie.com https://maps.google.com https://www.google.com",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  // HTTPS only, for a year (ignored by browsers on plain http://localhost)
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // A separate build folder can be chosen (e.g. for a preview build next to a running dev server)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Old WordPress addresses that should keep working
  async redirects() {
    return [
      { source: "/page/:n(\\d+)", destination: "/news-and-events/page/:n", permanent: true },
      { source: "/news-and-events/page/1", destination: "/news-and-events", permanent: true },
      { source: "/amar-gram-amar-shohor", destination: "/projects#amar-gram-amar-shohor", permanent: true },
      { source: "/responsible-use-of-electricity", destination: "/projects#responsible-use-of-electricity", permanent: true },
      { source: "/achieving-sdgs", destination: "/projects#achieving-sdgs", permanent: true },
      { source: "/green-finance", destination: "/projects#green-finance", permanent: true },
      { source: "/wp-content/uploads/:path*", destination: "/uploads/:path*", permanent: true },
      { source: "/feed", destination: "/news-and-events", permanent: false },
    ];
  },
};

export default nextConfig;
