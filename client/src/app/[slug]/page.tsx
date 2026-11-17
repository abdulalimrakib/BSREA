import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import { Container, RichText } from "@/components/site/blocks";
import { formatDate, getPost, getPosts, slugify } from "@/lib/content";

/*--A news post. WordPress served posts from the site root (bsreabd.org/<slug>/), so the same URLs work here.--*/

export const dynamicParams = false;

export function generateStaticParams() {
  return getPosts().map((post) => ({ slug: post.slug }));
}

type Props = { params: Promise<{ slug: string }> };

const findPost = async (params: Props["params"]) =>
  getPost(decodeURIComponent((await params).slug));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await findPost(params);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt.slice(0, 160),
    openGraph: {
      type: "article",
      publishedTime: post.date,
      images: post.image ? [post.image.src] : undefined,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const post = await findPost(params);
  if (!post) notFound();

  const posts = getPosts();
  const index = posts.findIndex((p) => p.id === post.id);
  const newer = posts[index - 1];
  const older = posts[index + 1];

  return (
    <article>
      <header className="relative isolate overflow-hidden bg-gradient-to-b from-brand-mint/70 to-brand-snow pt-14 pb-12 md:pt-20 md:pb-16">
        <div
          aria-hidden="true"
          className="absolute -top-32 right-[-10%] -z-10 size-[420px] rounded-full bg-brand-yellow/15 blur-[100px]"
        />
        <Container className="max-w-[860px]">
          <Link
            href="/news-and-events"
            className="group inline-flex items-center gap-2 text-sm font-medium text-brand-green"
          >
            <ArrowLeft
              className="size-4 transition-transform duration-300 group-hover:-translate-x-1"
              aria-hidden="true"
            />{" "}
            News and Events
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-medium">
            {post.categories.map((category) => (
              <Link
                key={category}
                href={`/category/${slugify(category)}`}
                className="rounded-full bg-white px-3 py-1 text-brand-green shadow-[0_1px_2px_rgb(25_42_61/0.06)] transition-colors hover:bg-brand-green hover:text-white"
              >
                {category}
              </Link>
            ))}
            <span className="inline-flex items-center gap-1.5 text-brand-gray">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              <time dateTime={post.date}>{formatDate(post.date)}</time>
            </span>
          </div>
          <h1 className="mt-5 text-3xl leading-[1.15] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 md:text-5xl">
            {post.title}
          </h1>
        </Container>
      </header>

      <Container className="max-w-[860px] pb-16 md:pb-24">
        {post.image && (
          <Image
            src={post.image.src}
            alt={post.image.alt || post.title}
            width={post.image.width ?? 1200}
            height={post.image.height ?? 800}
            priority
            sizes="(min-width: 860px) 812px, 100vw"
            className="h-auto w-full rounded-3xl shadow-[var(--shadow-lift)]"
          />
        )}
        <RichText html={post.content} className="mx-auto mt-12 max-w-[720px]" />

        <nav aria-label="More news" className="mt-16 grid gap-4 sm:grid-cols-2">
          {older ? (
            <Link
              href={`/${older.slug}`}
              className="group rounded-2xl border border-brand-navy/5 bg-white p-6 shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.15em] text-brand-gray uppercase">
                <ArrowLeft className="size-3.5" aria-hidden="true" /> Previous
              </span>
              <span className="mt-2 line-clamp-2 block font-serif text-lg font-semibold text-brand-navy transition-colors group-hover:text-brand-green">
                {older.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {newer && (
            <Link
              href={`/${newer.slug}`}
              className="group rounded-2xl border border-brand-navy/5 bg-white p-6 shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:text-right"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.15em] text-brand-gray uppercase">
                Next <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
              <span className="mt-2 line-clamp-2 block font-serif text-lg font-semibold text-brand-navy transition-colors group-hover:text-brand-green">
                {newer.title}
              </span>
            </Link>
          )}
        </nav>
      </Container>
    </article>
  );
}
