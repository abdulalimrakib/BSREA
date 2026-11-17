import type { MetadataRoute } from "next";
import { demoMode, site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // The demo copy is kept out of search results so it never competes with the official site
  if (demoMode) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${site.url}/sitemap.xml` };
}
