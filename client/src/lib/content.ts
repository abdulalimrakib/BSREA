/*--Reading the site content--*/
// The content was copied from the WordPress site (bsreabd.org) into src/content/*.json.
// Pages read it only through these functions, so moving it to the backend later means changing this file only.
// SERVER ONLY: never import this file from a "use client" component (it would ship every JSON file to browsers).
// Client components import small helpers from "@/lib/format" instead.

import postsData from "@/content/posts.json";
import membersData from "@/content/members.json";
import boardData from "@/content/board.json";
import logosData from "@/content/member-logos.json";
import galleryData from "@/content/gallery.json";

export type Post = {
  id: number;
  slug: string;
  title: string;
  date: string; // "2026-08-20T11:18:45"
  modified: string;
  categories: string[];
  tags: string[];
  excerpt: string;
  image: { src: string; width: number | null; height: number | null; alt: string } | null;
  content: string; // HTML
};

// Public directory entry. Members' phone numbers and emails are deliberately NOT here: they are personal data,
// kept only in the backend (encrypted), so they can't be harvested from the public website.
export type Member = {
  company: string;
  name: string;
  designation: string;
  address: string;
  website: string | null;
};

export type BoardMember = { name: string; position: string; designation: string; company: string; photo: string | null };

export const POSTS_PER_PAGE = 10;

// Newest first
const posts = (postsData as Post[]).slice().sort((a, b) => b.date.localeCompare(a.date));

export const getPosts = () => posts;

export const getPost = (slug: string) => posts.find((post) => post.slug === slug);

export const getPostsPage = (page: number, perPage = POSTS_PER_PAGE) => ({
  posts: posts.slice((page - 1) * perPage, page * perPage),
  page,
  totalPages: Math.max(1, Math.ceil(posts.length / perPage)),
});

/*--Link to a page of the news list: /news-and-events, /news-and-events/page/2, …--*/
export const newsPageHref = (page: number) => (page === 1 ? "/news-and-events" : `/news-and-events/page/${page}`);

/*--Category name <-> URL slug ("Events" <-> "events")--*/
export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const getCategories = () => {
  const names = new Set(posts.flatMap((post) => post.categories));
  return [...names].map((name) => ({ name, slug: slugify(name), count: posts.filter((p) => p.categories.includes(name)).length }));
};

export const getPostsInCategory = (slug: string) => posts.filter((post) => post.categories.some((c) => slugify(c) === slug));

export const getMembers = () => membersData as Member[];

/*--The board, in the three rows used on the site: president & secretary, vice presidents, directors--*/
export const getBoard = () => boardData as BoardMember[][];

export const getMemberLogos = () => logosData as { title: string; logos: { src: string; alt: string }[] }[];

export const getGallery = () => galleryData as { images: { full: string; thumb: string; alt: string }[]; videos: { title: string; youtube: string }[] };

// Kept here too so server pages can keep importing them from one place
export { formatDate, youtubeId } from "@/lib/format";
