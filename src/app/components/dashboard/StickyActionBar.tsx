"use client";

import React from "react";
import { Download, Loader2, Sparkles, Video } from "lucide-react";
import type { GenerationProgress } from "@/app/hooks/useVideoGeneration";
import { describeProgress } from "./GenerationProgressCard";

interface StickyActionBarProps {
  hasTranscript: boolean;
  sceneCount: number;
  totalDuration: number;
  isAnalyzing: boolean;
  isGenerating: boolean;
  isCancelling: boolean;
  progress: GenerationProgress | null;
  hasVideo: boolean;
  onAnalyze: () => void;
  onGenerate: () => void;
  onCancel: () => void;
  onShowExport: () => void;
}

// The one primary action for the current step, always within reach
// (including on mobile, where the storyboard gets long).
export default function StickyActionBar(p: StickyActionBarProps) {
  const hasScenes = p.sceneCount > 0;
  const kbd = (
    <kbd className="hidden md:inline ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-semibold">Ctrl ↵</kbd>
  );

  let summary: React.ReactNode;
  if (p.isGenerating && p.progress) {
    summary = (
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-ink truncate">{describeProgress(p.progress)}</span>
          <span className="font-bold text-ink tabular-nums">{p.progress.percent}%</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-surface-strong overflow-hidden">
          <div className="h-full bg-rausch transition-[width] duration-700" style={{ width: `${p.progress.percent}%` }} />
        </div>
      </div>
    );
  } else if (p.isAnalyzing) {
    summary = <span className="text-xs text-muted">Analyzing transcript and matching visuals…</span>;
  } else if (hasScenes) {
    summary = (
      <span className="text-xs text-muted">
        <span className="font-bold text-ink">{p.sceneCount} scenes</span> · {p.totalDuration.toFixed(0)}s
        {p.hasVideo && <span className="hidden sm:inline"> · video ready</span>}
      </span>
    );
  } else {
    summary = (
      <span className="text-xs text-muted">
        {p.hasTranscript ? "Transcript ready" : "Paste a YouTube link or transcript to start"}
      </span>
    );
  }

  const primary =
    "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed";

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-hairline-soft bg-canvas/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0 flex items-center">{summary}</div>

        {p.isGenerating ? (
          <button
            type="button"
            onClick={p.onCancel}
            disabled={p.isCancelling}
            className={`${primary} border border-hairline text-ink hover:bg-surface-soft disabled:opacity-50`}
          >
            {p.isCancelling ? "Cancelling…" : "Cancel"}
          </button>
        ) : hasScenes ? (
          <>
            {p.hasVideo && (
              <button
                type="button"
                onClick={p.onShowExport}
                className={`${primary} border border-hairline text-ink hover:bg-surface-soft`}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}
            <button
              type="button"
              onClick={p.onGenerate}
              disabled={p.isAnalyzing}
              className={`${primary} bg-rausch hover:bg-rausch-active text-white shadow-airbnb disabled:opacity-60`}
            >
              <Video className="w-4 h-4" />
              {p.hasVideo ? "Re-generate" : "Generate video"}
              {kbd}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={p.onAnalyze}
            disabled={!p.hasTranscript || p.isAnalyzing}
            className={`${primary} ${
              !p.hasTranscript || p.isAnalyzing
                ? "bg-surface-strong text-muted"
                : "bg-rausch hover:bg-rausch-active text-white shadow-airbnb"
            }`}
          >
            {p.isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {p.isAnalyzing ? "Analyzing…" : "Analyze transcript"}
            {!p.isAnalyzing && p.hasTranscript && kbd}
          </button>
        )}
      </div>
    </div>
  );
}
