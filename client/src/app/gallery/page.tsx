import type { Metadata } from "next";
import PhotoGallery from "@/components/gallery/photo-gallery";
import VideoPlaylist from "@/components/gallery/video-playlist";
import { PageBanner, Section, SectionHeading } from "@/components/site/blocks";
import { getGallery } from "@/lib/content";

export const metadata: Metadata = { title: "Gallery" };

export default function GalleryPage() {
  const { images, videos } = getGallery();
  return (
    <>
      <PageBanner title="Gallery" image="/uploads/2025/05/1737540598650.jpg" />

      <Section tone="white">
        <SectionHeading
          eyebrow="Videos"
          title="Stories of Impact"
          center
          className="mb-12"
        />
        <VideoPlaylist title="BSREA" videos={videos} />
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Photos"
          title="Moments that Inspire"
          center
          className="mb-12"
        />
        <PhotoGallery photos={images} />
      </Section>
    </>
  );
}
