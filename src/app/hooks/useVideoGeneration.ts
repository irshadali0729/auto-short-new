"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_MEDIA_SETTINGS,
  type MediaSettings,
} from "@/app/components/SettingsModal";
import {
  MAX_NOT_FOUND_POLLS,
  VIDEO_PROGRESS_POLL_INTERVAL_MS,
} from "@/app/config/client-config";
import type { Scene } from "@/app/types/scene";

export type GenerationStage = "starting" | "preparing" | "rendering_scenes" | "merging";

export interface GenerationProgress {
  stage: GenerationStage;
  percent: number;
  scenesCompleted: number;
  totalScenes: number;
  elapsedSec: number;
  /** null until at least one scene has rendered and a rate is known. */
  etaSec: number | null;
}

// Rough allowance for the final concat after the last scene renders.
const MERGE_ESTIMATE_SEC = 4;

interface StartOptions {
  scenes: Scene[];
  mediaSettings: MediaSettings;
  videoTitle: string;
  channelName: string;
}

interface Callbacks {
  onComplete: (result: { videoUrl: string; savedFilename?: string }) => void;
  onError: (message: string) => void;
}

function buildRequestBody(runId: string, o: StartOptions) {
  const s = o.mediaSettings;
  return {
    scenes: o.scenes,
    runId,
    videoTitle: o.videoTitle,
    channelName: o.channelName,
    zoomSpeed: s.zoomSpeed ?? DEFAULT_MEDIA_SETTINGS.zoomSpeed,
    transitionDuration: s.transitionDuration ?? DEFAULT_MEDIA_SETTINGS.transitionDuration,
    textOverlayMode: s.textOverlayMode || (s.enableGraphicMotion ? "graphics" : "captions"),
    captionPosition: s.captionPosition || DEFAULT_MEDIA_SETTINGS.captionPosition,
    captionTheme: s.captionTheme || DEFAULT_MEDIA_SETTINGS.captionTheme,
    enableGraphicMotion: s.textOverlayMode === "graphics",
    graphicMotionTheme: s.graphicMotionTheme || "auto",
    enableCaptions: s.textOverlayMode === "captions",
    aspectRatio: s.aspectRatio || "9:16",
    enableEmojiCaptions: s.enableEmojiCaptions !== false,
    emojiStyle: s.emojiStyle || "fluent",
    enableDuaOverlay: s.enableDuaOverlay !== false,
    duaCardTheme: s.duaCardTheme || "cream",
    duaCardPosition: s.duaCardPosition || "center",
    enableAvatarHost: s.enableAvatarHost !== false,
    avatarCategory: s.avatarCategory || "women_avatars",
    avatarId: s.avatarId || "Avatar-1",
  };
}

/**
 * Runs the fire-and-forget server render and polls its progress. The job
 * renders a snapshot of the scenes taken at start, so the storyboard stays
 * editable while it runs.
 */
export function useVideoGeneration({ onComplete, onError }: Callbacks) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef = useRef<string | null>(null);
  // Keep the latest callbacks without restarting an in-flight poll.
  const callbacksRef = useRef({ onComplete, onError });
  callbacksRef.current = { onComplete, onError };

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    runIdRef.current = null;
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const finish = useCallback(() => {
    stopPolling();
    setIsGenerating(false);
    setProgress(null);
  }, [stopPolling]);

  const start = useCallback(
    async (options: StartOptions) => {
      if (options.scenes.length === 0) return;
      stopPolling();

      const runId = "run_" + Date.now();
      runIdRef.current = runId;
      const startedAt = Date.now();
      let renderStartedAt: number | null = null;
      const total = options.scenes.length;

      setIsGenerating(true);
      setProgress({
        stage: "starting",
        percent: 2,
        scenesCompleted: 0,
        totalScenes: total,
        elapsedSec: 0,
        etaSec: null,
      });

      try {
        const initRes = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildRequestBody(runId, options)),
        });
        const initData = await initRes.json();
        if (!initRes.ok) {
          throw new Error(initData.error || "Failed to initialize video generation.");
        }
      } catch (err) {
        finish();
        callbacksRef.current.onError(
          err instanceof Error ? err.message : "Video generation failed to start.",
        );
        return;
      }

      let notFoundStreak = 0;
      pollRef.current = setInterval(async () => {
        if (runIdRef.current !== runId) return;
        try {
          const res = await fetch(`/api/generate-video/progress?runId=${runId}`);
          if (!res.ok) return;
          const data = await res.json();
          if (runIdRef.current !== runId) return;

          if (data.found === false) {
            // The dev server may have restarted and lost the in-memory job.
            if (++notFoundStreak >= MAX_NOT_FOUND_POLLS) {
              finish();
              callbacksRef.current.onError(
                "Lost track of this generation job (the server may have restarted).",
              );
            }
            return;
          }
          notFoundStreak = 0;

          if (data.complete) {
            finish();
            if (data.error) {
              callbacksRef.current.onError(data.error);
            } else if (data.videoPath) {
              callbacksRef.current.onComplete({
                videoUrl: data.videoPath,
                savedFilename: data.savedFilename,
              });
            } else {
              callbacksRef.current.onError(
                "Video generation completed, but no output path was returned.",
              );
            }
            return;
          }

          const now = Date.now();
          const elapsedSec = (now - startedAt) / 1000;
          const done = Number(data.scenesCompleted) || 0;
          const count = Number(data.totalScenes) || total;
          let percent = 5;
          let etaSec: number | null = null;
          const stage: GenerationStage =
            data.stage === "merging" || data.stage === "rendering_scenes"
              ? data.stage
              : "preparing";

          if (stage === "rendering_scenes") {
            renderStartedAt ??= now;
            percent = 5 + (85 * done) / count;
            if (done > 0) {
              const perScene = (now - renderStartedAt) / 1000 / done;
              etaSec = perScene * (count - done) + MERGE_ESTIMATE_SEC;
            }
          } else if (stage === "merging") {
            percent = 95;
            etaSec = MERGE_ESTIMATE_SEC;
          }

          setProgress({
            stage,
            percent: Math.min(99, Math.round(percent)),
            scenesCompleted: done,
            totalScenes: count,
            elapsedSec,
            etaSec,
          });
        } catch (pollErr) {
          console.error("Error polling background job status:", pollErr);
        }
      }, VIDEO_PROGRESS_POLL_INTERVAL_MS);
    },
    [finish, stopPolling],
  );

  const cancel = useCallback(async () => {
    const runId = runIdRef.current;
    if (!runId || isCancelling) return;
    setIsCancelling(true);
    try {
      await fetch("/api/generate-video/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
    } catch (err) {
      console.error("Error cancelling generation job:", err);
    } finally {
      finish();
      setIsCancelling(false);
    }
  }, [finish, isCancelling]);

  return { isGenerating, isCancelling, progress, start, cancel };
}
