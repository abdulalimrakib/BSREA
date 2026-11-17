import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NewsList from "@/components/site/news-list";
import { getCategories, getPostsInCategory } from "@/lib/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return getCategories().map((category) => ({ slug: category.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategories().find((c) => c.slug === slug);
  return { title: category?.name };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = getCategories().find((c) => c.slug === slug);
  if (!category) notFound();
  return <NewsList title={category.name} posts={getPostsInCategory(slug)} />;
}
