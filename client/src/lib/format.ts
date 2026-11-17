/*--Small helpers that are safe to use in client components (no data imports)--*/

/*--"2026-08-20T11:18:45" -> "August 20, 2026"--*/
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/*--Read the video id out of any YouTube link--*/
export const youtubeId = (url: string) => {
  const match = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return match ? match[1] : null;
};
