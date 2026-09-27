"use client";

import React from "react";
import { Film } from "lucide-react";
import type { GenerationProgress } from "@/app/hooks/useVideoGeneration";

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

export function describeProgress(p: GenerationProgress): string {
  if (p.stage === "rendering_scenes") {
    const current = Math.min(p.scenesCompleted + 1, p.totalScenes);
    return `Scene ${current} of ${p.totalScenes}${p.etaSec !== null ? ` · ~${formatDuration(p.etaSec)} left` : ""}`;
  }
  if (p.stage === "merging") return "Merging scenes into the final video…";
  if (p.stage === "starting") return "Starting render…";
  return "Preparing media and overlays…";
}

export default function GenerationProgressCard({
  progress,
  aspectRatio,
  isCancelling,
  onCancel,
}: {
  progress: GenerationProgress;
  aspectRatio: "9:16" | "16:9";
  isCancelling: boolean;
  onCancel: () => void;
}) {
  return (
    <section className="airbnb-card p-5" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#fff0f2] flex items-center justify-center shrink-0">
          <Film className="w-5 h-5 text-rausch" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-ink">
            Rendering {aspectRatio === "16:9" ? "16:9 widescreen video" : "9:16 vertical short"}
          </h3>
          <p className="text-xs text-muted truncate">{describeProgress(progress)}</p>
        </div>
        <span className="text-lg font-bold text-ink tabular-nums">{progress.percent}%</span>
      </div>

      <div
        className="mt-4 h-2 rounded-full bg-surface-strong overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-label="Render progress"
      >
        <div
          className="h-full rounded-full bg-rausch transition-[width] duration-700 ease-out"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted">
        <span>Elapsed {formatDuration(progress.elapsedSec)} · keep editing, changes apply to the next render</span>
        <button
          type="button"
          onClick={onCancel}
          disabled={isCancelling}
          className="shrink-0 px-3 py-1.5 rounded-lg border border-hairline text-xs font-bold text-ink hover:bg-surface-soft disabled:opacity-50"
        >
          {isCancelling ? "Cancelling…" : "Cancel"}
        </button>
      </div>
    </section>
  );
}
