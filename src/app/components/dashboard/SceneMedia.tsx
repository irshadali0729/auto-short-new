"use client";

import React from "react";
import { getMediaUrl, isVideoAsset } from "@/app/utils/media-url";

// Image or muted looping video for a scene asset (card and timeline thumbnails).
export default function SceneMedia({
  src,
  alt,
  className = "",
  autoPlay = true,
  onError,
  onLoad,
}: {
  src: string;
  alt: string;
  className?: string;
  autoPlay?: boolean;
  onError?: () => void;
  onLoad?: () => void;
}) {
  if (isVideoAsset(src)) {
    return (
      <video
        src={getMediaUrl(src)}
        autoPlay={autoPlay}
        loop
        muted
        playsInline
        preload="metadata"
        className={className}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getMediaUrl(src)}
      alt={alt}
      className={className}
      loading="lazy"
      onError={onError}
      onLoad={onLoad}
    />
  );
}
