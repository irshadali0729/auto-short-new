"use client";

import React, { useRef } from "react";
import { CheckCircle2, Clapperboard, Play } from "lucide-react";
import SceneLivePreviewPlayer from "@/app/components/SceneLivePreviewPlayer";
import type { MediaSettings, CaptionPosition } from "@/app/components/SettingsModal";
import type { Scene } from "@/app/types/scene";
import type { GenerationProgress } from "@/app/hooks/useVideoGeneration";
import type { PushToast } from "@/app/hooks/useToasts";
import GenerationProgressCard from "./GenerationProgressCard";
import ExportPanel, { type SeoState } from "./ExportPanel";

export type PreviewTab = "preview" | "final";

interface PreviewPanelProps {
  tab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
  scenes: Scene[];
  activeIndex: number;
  onSelectScene: (index: number) => void;
  mediaSettings: MediaSettings;
  onChangeCaptionPosition: (position: CaptionPosition) => void;
  onOpenDuaEditor: (index: number) => void;
  isAnalyzing: boolean;
  isGenerating: boolean;
  isCancelling: boolean;
  progress: GenerationProgress | null;
  onCancel: () => void;
  videoUrl: string;
  savedFilename: string;
  seoState: SeoState;
  onGenerateSeo: () => void;
  notify: PushToast;
}

export default function PreviewPanel(props: PreviewPanelProps) {
  const { tab, scenes, mediaSettings, videoUrl, isGenerating, progress } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const aspectRatio = mediaSettings.aspectRatio === "16:9" ? "16:9" : "9:16";
  const hasScenes = scenes.length > 0;
  const hasVideo = Boolean(videoUrl);

  const tabBtn = (id: "preview" | "final", label: string, icon: React.ReactNode, disabled: boolean) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      disabled={disabled}
      onClick={() => props.onTabChange(id)}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 ${
        tab === id ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div id="step-preview" className="flex flex-col gap-4 scroll-mt-28">
      {isGenerating && progress && (
        <GenerationProgressCard
          progress={progress}
          aspectRatio={aspectRatio}
          isCancelling={props.isCancelling}
          onCancel={props.onCancel}
        />
      )}

      {(hasScenes || hasVideo) && (
        <div role="tablist" aria-label="Preview mode" className="flex p-1 rounded-xl bg-surface-strong">
          {tabBtn("preview", "Storyboard preview", <Clapperboard className="w-3.5 h-3.5" />, !hasScenes)}
          {tabBtn(
            "final",
            "Final video",
            hasVideo ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Play className="w-3.5 h-3.5" />,
            !hasVideo,
          )}
        </div>
      )}

      {tab === "preview" && hasScenes && (
        <SceneLivePreviewPlayer
          scenes={scenes}
          activeSceneIndex={props.activeIndex}
          onSelectScene={props.onSelectScene}
          mediaSettings={mediaSettings}
          onChangeCaptionPosition={props.onChangeCaptionPosition}
          onOpenDuaEditor={props.onOpenDuaEditor}
        />
      )}

      {tab === "final" && hasVideo && (
        <section id="step-export" className="airbnb-card p-5 flex flex-col items-center gap-5 scroll-mt-28">
          <div
            className={`relative w-full ${
              aspectRatio === "16:9" ? "aspect-video" : "max-w-[280px] aspect-[9/16]"
            } rounded-2xl overflow-hidden bg-black shadow-airbnb`}
          >
            <video ref={videoRef} src={videoUrl} controls playsInline className="w-full h-full object-contain" />
          </div>
          <ExportPanel
            videoUrl={videoUrl}
            savedFilename={props.savedFilename}
            videoRef={videoRef}
            seoState={props.seoState}
            onGenerateSeo={props.onGenerateSeo}
            notify={props.notify}
          />
        </section>
      )}

      {!hasScenes && !hasVideo && (
        <section className="rounded-2xl border border-dashed border-hairline p-8 text-center flex flex-col items-center justify-center min-h-[360px] lg:min-h-[480px] bg-surface-soft/40">
          <div className="w-14 h-14 rounded-full bg-canvas border border-hairline flex items-center justify-center mb-4 shadow-airbnb">
            {props.isAnalyzing ? (
              <div className="w-6 h-6 rounded-full border-2 border-[#ffd1da] border-t-rausch animate-spin" />
            ) : (
              <Play className="w-6 h-6 text-muted" />
            )}
          </div>
          <h3 className="text-base font-bold text-ink mb-1">
            {props.isAnalyzing ? "Building your scenes…" : "Your preview appears here"}
          </h3>
          <p className="text-xs text-muted max-w-[260px]">
            {props.isAnalyzing
              ? "Splitting the transcript into scenes and finding matching visuals."
              : `Add a transcript and press Analyze to get a ${aspectRatio} storyboard you can preview and export.`}
          </p>
        </section>
      )}
    </div>
  );
}
