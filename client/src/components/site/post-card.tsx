import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import type { Post } from "@/lib/content";
import { formatDate } from "@/lib/format";

/*--Card used on the home page: image, date, title, "Read more"--*/
export function PostCardCompact({ post }: { post: Post }) {
  const href = `/${post.slug}`;
  return (
    <article className="reveal group relative flex flex-col overflow-hidden rounded-3xl border border-brand-navy/5 bg-white shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]">
      <div className="relative aspect-[3/2] overflow-hidden bg-brand-mist">
        {post.image && (
          <Image
            src={post.image.src}
            alt=""
            fill
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 ease-[var(--ease-smooth)] group-hover:scale-[1.06]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="flex items-center gap-2 text-xs font-medium text-brand-gray">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          <time dateTime={post.date}>{formatDate(post.date)}</time>
        </p>
        <h3 className="mt-3 line-clamp-3 text-[17px] leading-snug font-semibold text-brand-navy transition-colors group-hover:text-brand-green">
          {/* The whole card is clickable through this link */}
          <Link href={href} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h3>
        <span
          className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-brand-green"
          aria-hidden="true"
        >
          Read more{" "}
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}

/*--Larger card used on News and Events: image, date, title, excerpt--*/
export function PostCard({ post }: { post: Post }) {
  const href = `/${post.slug}`;
  return (
    <article className="reveal group relative flex flex-col overflow-hidden rounded-3xl border border-brand-navy/5 bg-white shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-smooth)] hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]">
      {post.image && (
        <div className="relative aspect-[16/10] overflow-hidden bg-brand-mist">
          <Image
            src={post.image.src}
            alt=""
            fill
            sizes="(min-width: 768px) 580px, 100vw"
            className="object-cover transition-transform duration-700 ease-[var(--ease-smooth)] group-hover:scale-[1.05]"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-7 md:p-8">
        <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-gray uppercase">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          <time dateTime={post.date}>{formatDate(post.date)}</time>
        </p>
        <h2 className="mt-3 text-2xl leading-snug transition-colors group-hover:text-brand-green">
          <Link href={href} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h2>
        <p className="mt-4 line-clamp-4 text-[15px] leading-7 text-brand-slate">
          {post.excerpt}
        </p>
        <span
          className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-brand-green"
          aria-hidden="true"
        >
          Read more{" "}
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}
