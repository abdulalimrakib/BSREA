import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NewsList from "@/components/site/news-list";
import { getPostsPage, newsPageHref } from "@/lib/content";

/*--/news-and-events/page/2, /news-and-events/page/3, … (page 1 is /news-and-events)--*/

export const dynamicParams = false;

export function generateStaticParams() {
  const { totalPages } = getPostsPage(1);
  return Array.from({ length: totalPages - 1 }, (_, i) => ({
    page: String(i + 2),
  }));
}

type Props = { params: Promise<{ page: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await params;
  return { title: `News and Events – Page ${page}` };
}

export default async function NewsPage({ params }: Props) {
  const page = Number((await params).page);
  const result = getPostsPage(page);
  if (!Number.isInteger(page) || page < 1 || page > result.totalPages)
    notFound();
  return (
    <NewsList
      title="News and Events"
      posts={result.posts}
      page={page}
      totalPages={result.totalPages}
      hrefFor={newsPageHref}
    />
  );
}
