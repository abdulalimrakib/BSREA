import type { Metadata } from "next";
import NewsList from "@/components/site/news-list";
import { getPostsPage, newsPageHref } from "@/lib/content";

export const metadata: Metadata = { title: "News and Events" };

export default function NewsAndEventsPage() {
  const { posts, page, totalPages } = getPostsPage(1);
  return (
    <NewsList
      title="News and Events"
      posts={posts}
      page={page}
      totalPages={totalPages}
      hrefFor={newsPageHref}
    />
  );
}
