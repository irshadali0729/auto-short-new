"use client";

import { useEffect } from "react";
import type { Scene, TranscriptSegment } from "@/app/types/scene";

const DRAFT_STORAGE_KEY = "auto_shorts_draft_v1";
const SAVE_DEBOUNCE_MS = 800;

export interface DraftProject {
  transcript: string;
  transcriptSegments: TranscriptSegment[];
  youtubeLink: string;
  videoTitle: string;
  channelName: string;
  targetVideoLength: number | "";
  scenes: Scene[];
  savedAt?: number;
}

export function loadDraft(): DraftProject | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as DraftProject;
    if (!draft.transcript && !(draft.scenes && draft.scenes.length)) return null;
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {}
}

/**
 * Debounced save of the working project so a refresh doesn't lose the
 * transcript or an edited storyboard. `enabled` stays false until the initial
 * restore has run, so an empty first render can't overwrite a saved draft.
 */
export function useDraftAutosave(draft: DraftProject, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      try {
        if (!draft.transcript.trim() && draft.scenes.length === 0) {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
          return;
        }
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({ ...draft, savedAt: Date.now() }),
        );
      } catch (err) {
        // Quota exceeded (very long transcripts) — autosave is best-effort.
        console.warn("Could not autosave draft:", err);
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, enabled]);
}
