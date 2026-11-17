import type { MetadataRoute } from "next";
import { getPosts } from "@/lib/content";
import { mainMenu, site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = mainMenu
    .flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)])
    .filter((href): href is string => !!href)
    .concat(["/bsrea-newsletter", "/job-circular-event-program-officer"]);

  return [
    ...[...new Set(pages)].map((href) => ({ url: `${site.url}${href === "/" ? "" : href}`, changeFrequency: "monthly" as const })),
    ...getPosts().map((post) => ({ url: `${site.url}/${encodeURIComponent(post.slug)}`, lastModified: post.modified })),
  ];
}
