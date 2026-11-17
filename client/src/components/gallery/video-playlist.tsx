"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import YouTubeEmbed from "@/components/site/youtube-embed";
import { youtubeId } from "@/lib/format";
import { cn } from "@/lib/utils";

/*--A video player with the playlist beside it--*/
export default function VideoPlaylist({
  title,
  videos,
}: {
  title: string;
  videos: { title: string; youtube: string }[];
}) {
  const [active, setActive] = useState(0);
  const video = videos[active];

  return (
    <div className="reveal grid overflow-hidden rounded-3xl bg-brand-navy shadow-[var(--shadow-lift)] lg:grid-cols-[2fr_1fr]">
      <YouTubeEmbed
        key={video.youtube}
        url={video.youtube}
        title={video.title}
      />
      <div className="flex max-h-[420px] flex-col">
        <p className="border-b border-white/10 px-5 py-4 font-semibold text-white">
          {title}{" "}
          <span className="text-sm font-normal text-white/60">
            · {videos.length} videos
          </span>
        </p>
        <ul className="overflow-y-auto">
          {videos.map((v, i) => {
            const id = youtubeId(v.youtube);
            return (
              <li key={v.youtube}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-current={i === active}
                  className={cn(
                    "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-white/5",
                    i === active &&
                      "bg-white/10 shadow-[inset_3px_0_0_var(--brand-yellow)]",
                  )}
                >
                  <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-black">
                    {id && (
                      // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
                      <img
                        src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
                        alt=""
                        className="size-full object-cover"
                      />
                    )}
                    {i === active && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                        <Play className="size-4 fill-current" />
                      </span>
                    )}
                  </span>
                  <span className="text-sm leading-snug text-white">
                    {v.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
