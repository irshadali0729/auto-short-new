"use client";

import React, { useState } from "react";
import { Camera, Check, Copy, Download, Loader2, Sparkles } from "lucide-react";
import type { PushToast } from "@/app/hooks/useToasts";

export interface SeoMetadata {
  title: string;
  hashtags: string[];
  description: string;
}

export type SeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; seo: SeoMetadata }
  | { status: "error"; message: string };

function CopyButton({ text, label, notify }: { text: string; label: string; notify: PushToast }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          notify({ kind: "error", title: "Couldn't copy", message: "Clipboard access was blocked by the browser." });
        }
      }}
      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-hairline text-[11px] font-bold text-ink hover:bg-surface-soft"
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function ExportPanel({
  videoUrl,
  savedFilename,
  videoRef,
  seoState,
  onGenerateSeo,
  notify,
}: {
  videoUrl: string;
  savedFilename: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  seoState: SeoState;
  onGenerateSeo: () => void;
  notify: PushToast;
}) {
  const [quality, setQuality] = useState<"1080" | "720">("1080");
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  const sep = videoUrl.includes("?") ? "&" : "?";
  const downloadHref = `${videoUrl}${sep}download=true${quality === "720" ? "&quality=720" : ""}`;
  const downloadName = quality === "720" ? savedFilename.replace(/\.mp4$/i, "_720p.mp4") : savedFilename;
  const thumbName = savedFilename.replace(/\.mp4$/i, "_thumbnail.png");

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      notify({ kind: "info", title: "Video not ready", message: "Play or scrub the video first, then capture." });
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setThumbnail(canvas.toDataURL("image/png"));
  };

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Download */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-ink uppercase tracking-wide">Quality</span>
          <div role="radiogroup" aria-label="Export quality" className="inline-flex p-0.5 rounded-lg bg-surface-strong">
            {(["1080", "720"] as const).map((q) => (
              <button
                key={q}
                type="button"
                role="radio"
                aria-checked={quality === q}
                onClick={() => setQuality(q)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  quality === q ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {q}p
              </button>
            ))}
          </div>
        </div>
        <a
          href={downloadHref}
          download={downloadName}
          className="w-full py-3 rounded-xl font-bold text-sm bg-rausch hover:bg-rausch-active text-white flex items-center justify-center gap-2 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download MP4 · {quality}p
        </a>
        {quality === "720" && (
          <p className="text-[11px] text-muted text-center">The first 720p download takes a few seconds to convert.</p>
        )}
      </div>

      {/* SEO */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold text-ink uppercase tracking-wide">Title & hashtags</span>
        {seoState.status === "ready" ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-soft">
              <p className="flex-1 text-xs font-semibold text-ink">{seoState.seo.title}</p>
              <CopyButton text={seoState.seo.title} label="title" notify={notify} />
            </div>
            {seoState.seo.hashtags.length > 0 && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-soft">
                <p className="flex-1 text-xs text-sky-700 dark:text-sky-400 break-words">{seoState.seo.hashtags.join(" ")}</p>
                <CopyButton text={seoState.seo.hashtags.join(" ")} label="hashtags" notify={notify} />
              </div>
            )}
            {seoState.seo.description && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-soft">
                <p className="flex-1 text-xs text-muted line-clamp-3 whitespace-pre-line">{seoState.seo.description}</p>
                <CopyButton text={seoState.seo.description} label="description" notify={notify} />
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onGenerateSeo}
            disabled={seoState.status === "loading"}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-hairline text-xs font-bold text-ink hover:bg-surface-soft disabled:opacity-60"
          >
            {seoState.status === "loading" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-rausch" />
            )}
            {seoState.status === "loading"
              ? "Writing title & hashtags…"
              : seoState.status === "error"
                ? "Retry title & hashtags"
                : "Generate title & hashtags"}
          </button>
        )}
      </div>

      {/* Thumbnail */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold text-ink uppercase tracking-wide">Thumbnail</span>
        <p className="text-[11px] text-muted">Pause the video on the frame you want, then capture it.</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={captureFrame}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-hairline text-xs font-bold text-ink hover:bg-surface-soft"
          >
            <Camera className="w-3.5 h-3.5" />
            Use current frame
          </button>
          {thumbnail && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbnail} alt="Selected thumbnail" className="h-14 rounded-md border border-hairline" />
              <a
                href={thumbnail}
                download={thumbName}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ink text-white text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                PNG
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
