"use client";

import React, { forwardRef } from "react";
import { Clock, Link2, Loader2, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import type { TranscriptSegment } from "@/app/types/scene";

const YOUTUBE_URL_RE =
  /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)[\w-]{6,}\S*$/i;

export function isYoutubeUrl(text: string): boolean {
  return YOUTUBE_URL_RE.test(text.trim());
}

export const SAMPLE_TRANSCRIPT =
  "Most people wait for motivation before they start. But motivation is not the spark, it is the result. " +
  "The moment you take one small step, your brain rewards you, and that reward becomes the energy for the next step. " +
  "So stop waiting to feel ready. Write one line, walk for five minutes, send that one message. " +
  "Action creates motivation, not the other way around. Start small today, and let momentum do the rest.";

interface InputPanelProps {
  value: string;
  onChange: (value: string) => void;
  onImportYoutube: (url: string) => void;
  onUseSample: () => void;
  onReset: () => void;
  isFetching: boolean;
  isBusy: boolean;
  sourceTitle: string;
  transcriptSegments: TranscriptSegment[];
  onUnlinkSegments: () => void;
  targetVideoLength: number | "";
  onTargetLengthChange: (value: string) => void;
  /** Shown once scenes exist (the sticky bar then offers Generate instead). */
  onReanalyze?: () => void;
}

// One box for both input paths: paste a YouTube link (auto-imports its
// transcript) or paste/type the script itself.
const InputPanel = forwardRef<HTMLTextAreaElement, InputPanelProps>(function InputPanel(
  {
    value,
    onChange,
    onImportYoutube,
    onUseSample,
    onReset,
    isFetching,
    isBusy,
    sourceTitle,
    transcriptSegments,
    onUnlinkSegments,
    targetVideoLength,
    onTargetLengthChange,
    onReanalyze,
  },
  ref,
) {
  const looksLikeUrl = isYoutubeUrl(value);
  const isEmpty = !value.trim();
  const audioLength = transcriptSegments[transcriptSegments.length - 1]?.end;

  return (
    <section id="step-transcript" className="airbnb-card p-5 sm:p-6 scroll-mt-28">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-ink">Transcript</h2>
        {!isEmpty && (
          <button
            type="button"
            onClick={onReset}
            disabled={isBusy}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      <div className="relative">
        <label htmlFor="transcript-input" className="sr-only">
          YouTube link or transcript
        </label>
        <textarea
          id="transcript-input"
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            // Pasting a bare link into an empty box imports it right away.
            if (isEmpty && isYoutubeUrl(pasted)) {
              e.preventDefault();
              onChange(pasted.trim());
              onImportYoutube(pasted.trim());
            }
          }}
          disabled={isBusy}
          placeholder="Paste a YouTube link, or paste your script / transcript here…"
          className={`w-full rounded-xl border border-hairline bg-canvas p-4 text-sm text-ink placeholder-muted resize-y outline-none transition-all focus:border-ink disabled:opacity-60 ${
            looksLikeUrl ? "h-20" : "h-48"
          }`}
        />

        {isEmpty && !isBusy && (
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onUseSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline bg-surface-soft hover:bg-surface-strong text-xs font-semibold text-ink transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5 text-rausch" />
              Try a sample transcript
            </button>
          </div>
        )}
      </div>

      {looksLikeUrl && (
        <button
          type="button"
          onClick={() => onImportYoutube(value.trim())}
          disabled={isFetching || isBusy}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-ink text-white text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          {isFetching ? "Importing transcript…" : "Import transcript from YouTube"}
        </button>
      )}

      {sourceTitle && !looksLikeUrl && (
        <p className="mt-2 text-xs text-muted truncate">
          <span className="font-semibold text-ink">From YouTube:</span> {sourceTitle}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink" htmlFor="target-length">
          <Clock className="w-4 h-4 text-rausch" />
          Length
        </label>
        <div className="relative">
          <input
            id="target-length"
            type="number"
            min="1"
            max="300"
            step="1"
            value={targetVideoLength}
            onChange={(e) => onTargetLengthChange(e.target.value)}
            disabled={isBusy}
            className="w-24 pl-3 pr-7 py-2 rounded-lg border border-hairline bg-canvas text-sm text-ink outline-none focus:border-ink tabular-nums"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">s</span>
        </div>

        {transcriptSegments.length > 0 && (
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#ecfdf5] border border-[#a7f3d0] text-[11px] font-semibold text-[#065f46]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Synced to audio · {transcriptSegments.length} segments · {audioLength?.toFixed(0)}s
            <button type="button" onClick={onUnlinkSegments} className="underline hover:no-underline">
              Unlink
            </button>
          </span>
        )}

        {onReanalyze ? (
          <button
            type="button"
            onClick={onReanalyze}
            disabled={isBusy || isEmpty || looksLikeUrl}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-hairline text-xs font-bold text-ink hover:bg-surface-soft disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-rausch" />
            Re-analyze
          </button>
        ) : (
          <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-[11px] text-muted">
            <Sparkles className="w-3 h-3" />
            <kbd className="px-1.5 py-0.5 rounded border border-hairline bg-surface-soft font-sans">Ctrl</kbd>+
            <kbd className="px-1.5 py-0.5 rounded border border-hairline bg-surface-soft font-sans">Enter</kbd>
            to analyze
          </span>
        )}
      </div>
    </section>
  );
});

export default InputPanel;
