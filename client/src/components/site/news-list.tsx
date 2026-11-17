import { Container, Eyebrow } from "@/components/site/blocks";
import Pagination from "@/components/site/pagination";
import { PostCard } from "@/components/site/post-card";
import type { Post } from "@/lib/content";

/*--A heading, a two-column grid of post cards and page links (News and Events, category pages)--*/
export default function NewsList({
  title,
  posts,
  page = 1,
  totalPages = 1,
  hrefFor,
}: {
  title: string;
  posts: Post[];
  page?: number;
  totalPages?: number;
  hrefFor?: (page: number) => string;
}) {
  return (
    <section className="py-16 md:py-24">
      <Container>
        <Eyebrow>Media Center</Eyebrow>
        <h1 className="mt-4 text-4xl md:text-[52px]">{title}</h1>
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
        {hrefFor && (
          <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
        )}
      </Container>
    </section>
  );
}
