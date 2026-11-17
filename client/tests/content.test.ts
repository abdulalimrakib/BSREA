import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  getBoard,
  getGallery,
  getMemberLogos,
  getMembers,
  getPost,
  getPosts,
  getPostsPage,
  youtubeId,
} from "@/lib/content";
import { pageNumbers } from "@/components/members/table-pagination";

const publicFile = (src: string) =>
  path.join(__dirname, "..", "public", decodeURI(src));

describe("site content", () => {
  it("has all posts newest first, each with a unique slug", () => {
    const posts = getPosts();
    expect(posts.length).toBeGreaterThanOrEqual(50);
    expect(new Set(posts.map((p) => p.slug)).size).toBe(posts.length);
    expect(posts.every((p, i) => i === 0 || posts[i - 1].date >= p.date)).toBe(
      true,
    );
    expect(getPost(posts[3].slug)?.id).toBe(posts[3].id);
  });

  it("pages the news list", () => {
    const { posts, totalPages } = getPostsPage(2, 10);
    expect(posts).toHaveLength(10);
    expect(totalPages).toBe(Math.ceil(getPosts().length / 10));
  });

  it("has the member directory and board", () => {
    expect(getMembers().length).toBeGreaterThan(200);
    // Personal contact details must never be part of the public website
    expect(getMembers().every((m) => !("mobile" in m) && !("email" in m))).toBe(
      true,
    );
    expect(
      getBoard()
        .flat()
        .map((m) => m.name),
    ).toContain("Mostafa Al Mahmud");
  });

  it("only points to images that exist in public/", () => {
    const images = [
      ...getPosts().flatMap((p) => [
        p.image?.src,
        ...[...p.content.matchAll(/src="(\/uploads\/[^"]+)"/g)].map(
          (m) => m[1],
        ),
      ]),
      ...getBoard()
        .flat()
        .map((m) => m.photo),
      ...getMemberLogos().flatMap((t) => t.logos.map((l) => l.src)),
      ...getGallery().images.flatMap((i) => [i.full, i.thumb]),
    ].filter((src): src is string => !!src);
    const missing = images.filter((src) => !fs.existsSync(publicFile(src)));
    expect(missing).toEqual([]);
  });

  it("reads YouTube ids", () => {
    expect(youtubeId("https://youtu.be/9_uUuDVurYw")).toBe("9_uUuDVurYw");
    expect(youtubeId("https://www.youtube.com/watch?v=QtuykURZdm0")).toBe(
      "QtuykURZdm0",
    );
    expect(youtubeId("https://example.com")).toBeNull();
  });

  it("shortens long page lists", () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(6, 16)).toEqual([1, "…", 5, 6, 7, "…", 16]);
  });
});
