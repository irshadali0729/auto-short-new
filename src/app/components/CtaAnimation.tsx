"use client";

import React from "react";
import { getMediaUrl } from "@/app/utils/media-url";

// Plays a subscribe/share/bell animation from image-library/cta/. WebM keeps
// its transparency in Chrome/Edge/Firefox; GIFs always loop from the start.
export default function CtaAnimation({
  path,
  className,
  loop = true,
  startAt = 0,
}: {
  path: string;
  className?: string;
  loop?: boolean;
  /** Seconds into the animation to begin from (continuing across scenes). */
  startAt?: number;
}) {
  const url = getMediaUrl(path);
  return /\.gif$/i.test(path) ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={url} alt="" className={className} />
  ) : (
    <video
      src={url}
      autoPlay
      loop={loop}
      muted
      playsInline
      className={className}
      onLoadedMetadata={(e) => {
        if (startAt > 0) e.currentTarget.currentTime = startAt;
      }}
    />
  );
}
