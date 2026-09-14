'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  Film,
  Video,
  Layers,
  Sliders,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  RefreshCw,
  Clock,
  Volume2,
} from 'lucide-react';
import { MediaSettings } from '@/app/components/SettingsModal';
import { getMediaUrl, isVideoAsset } from '@/app/utils/media-url';
import { generateDuaCardSvg } from '@/app/utils/dua-card-svg';
import { CaptionPosition } from '@/app/utils/caption-renderer';

export interface StoryboardScene {
  keyword: string;
  image: string;
  duration: number;
  emoji?: string;
  isHostScene?: boolean;
  isSplitScreen?: boolean;
  hostAsset?: string;
  isFallback?: boolean;
  matchedTier?: string;
  visualQuery?: string;
  captions?: Array<{ text: string; start: number; end: number }>;
  graphics?: Array<{
    prefixText?: string;
    heroWord: string;
    suffixText?: string;
    start: number;
    end: number;
    colorScheme?: string;
  }>;
  duaInfo?: {
    isDua: boolean;
    hindi: string;
    arabic: string;
    title?: string;
    reference?: string;
    theme?: any;
    position?: any;
    cardStyle?: any;
  };
}

interface SceneLivePreviewPlayerProps {
  scenes: StoryboardScene[];
  activeSceneIndex: number;
  onSelectScene: (index: number) => void;
  mediaSettings: MediaSettings;
  onChangeCaptionPosition?: (position: CaptionPosition) => void;
  onOpenDuaEditor?: (index: number) => void;
  onGenerateVideo: () => void;
  isGenerating?: boolean;
}

export default function SceneLivePreviewPlayer({
  scenes,
  activeSceneIndex,
  onSelectScene,
  mediaSettings,
  onChangeCaptionPosition,
  onOpenDuaEditor,
  onGenerateVideo,
  isGenerating = false,
}: SceneLivePreviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sceneProgress, setSceneProgress] = useState(0); // 0 to 100% within active scene
  const [activeCaptionText, setActiveCaptionText] = useState<string>('');
  const [activeGraphic, setActiveGraphic] = useState<StoryboardScene['graphics'] extends (infer U)[] | undefined ? U : undefined>(undefined);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const playbackStartTimeRef = useRef<number>(Date.now());
  const sceneElapsedRef = useRef<number>(0);

  const activeScene = scenes[activeSceneIndex] || scenes[0];
  const isLandscape = mediaSettings.aspectRatio === '16:9';
  const captionPos = mediaSettings.captionPosition || 'bottom';

  // Calculate total duration and current scene time offsets
  const totalDuration = scenes.reduce((acc, s) => acc + (s.duration || 5), 0);
  const sceneDuration = activeScene?.duration || 5;

  // Handle Play/Pause timer loop
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = 50;
    playbackStartTimeRef.current = Date.now() - sceneElapsedRef.current * 1000;

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsedSec = (now - playbackStartTimeRef.current) / 1000;
      sceneElapsedRef.current = elapsedSec;

      const progress = Math.min(100, (elapsedSec / sceneDuration) * 100);
      setSceneProgress(progress);

      // Handle captions/graphics sync within active scene
      if (activeScene?.captions && activeScene.captions.length > 0) {
        const currentCap = activeScene.captions.find(
          (c) => elapsedSec >= c.start && elapsedSec <= (c.end || c.start + 2.5)
        );
        setActiveCaptionText(currentCap ? currentCap.text : activeScene.captions[0]?.text || '');
      } else {
        setActiveCaptionText('');
      }

      if (activeScene?.graphics && activeScene.graphics.length > 0) {
        const currentGfx = activeScene.graphics.find(
          (g) => elapsedSec >= g.start && elapsedSec <= (g.end || g.start + 2.5)
        );
        setActiveGraphic(currentGfx || activeScene.graphics[0]);
      } else {
        setActiveGraphic(undefined);
      }

      // If scene duration reached, advance to next scene
      if (elapsedSec >= sceneDuration) {
        sceneElapsedRef.current = 0;
        if (activeSceneIndex < scenes.length - 1) {
          onSelectScene(activeSceneIndex + 1);
        } else {
          // Loop back to scene 0 or stop
          onSelectScene(0);
        }
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, activeSceneIndex, sceneDuration, scenes.length, activeScene, onSelectScene]);

  // Reset progress when scene changes
  useEffect(() => {
    sceneElapsedRef.current = 0;
    setSceneProgress(0);
    if (activeScene?.captions && activeScene.captions.length > 0) {
      setActiveCaptionText(activeScene.captions[0]?.text || '');
    } else {
      setActiveCaptionText('');
    }
    if (activeScene?.graphics && activeScene.graphics.length > 0) {
      setActiveGraphic(activeScene.graphics[0]);
    } else {
      setActiveGraphic(undefined);
    }
  }, [activeSceneIndex, activeScene]);

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handlePrevScene = () => {
    sceneElapsedRef.current = 0;
    setSceneProgress(0);
    if (activeSceneIndex > 0) {
      onSelectScene(activeSceneIndex - 1);
    } else {
      onSelectScene(scenes.length - 1);
    }
  };

  const handleNextScene = () => {
    sceneElapsedRef.current = 0;
    setSceneProgress(0);
    if (activeSceneIndex < scenes.length - 1) {
      onSelectScene(activeSceneIndex + 1);
    } else {
      onSelectScene(0);
    }
  };

  if (!activeScene) return null;

  // Generate Dua Card SVG for live overlay
  let liveDuaCardSvg = '';
  if (activeScene.duaInfo?.isDua) {
    const targetW = isLandscape ? 1920 : 1080;
    const targetH = isLandscape ? 1080 : 1920;
    liveDuaCardSvg = generateDuaCardSvg(
      activeScene.duaInfo,
      targetW,
      targetH,
      mediaSettings.duaCardTheme || 'cream'
    );
  }

  return (
    <section className="airbnb-card p-4 sm:p-5 shadow-airbnb border border-hairline bg-white flex flex-col items-center">
      
      {/* Header Bar with Live Preview Indicator & Caption Quick Position Switcher */}
      <div className="w-full flex items-center justify-between gap-2 pb-3 mb-3 border-b border-hairline-soft">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPlaying ? 'bg-rausch opacity-75' : 'bg-emerald-400 opacity-75'}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPlaying ? 'bg-rausch' : 'bg-emerald-600'}`}></span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-1.5 leading-none">
              Live Storyboard Preview
            </h3>
            <span className="text-[10px] text-muted font-medium">
              Scene {activeSceneIndex + 1} of {scenes.length} • {sceneDuration.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Quick Caption Position Toggle */}
        {onChangeCaptionPosition && mediaSettings.textOverlayMode !== 'none' && (
          <div className="flex items-center bg-surface-soft p-0.5 rounded-lg border border-hairline-soft text-[10px]">
            <button
              type="button"
              onClick={() => onChangeCaptionPosition('top')}
              className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                captionPos === 'top'
                  ? 'bg-white text-rausch shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
              title="Align captions at Top"
            >
              <AlignVerticalJustifyStart className="w-3 h-3" />
              <span className="hidden sm:inline">Top</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeCaptionPosition('middle')}
              className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                captionPos === 'middle'
                  ? 'bg-white text-rausch shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
              title="Align captions at Middle"
            >
              <AlignVerticalJustifyCenter className="w-3 h-3" />
              <span className="hidden sm:inline">Mid</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeCaptionPosition('bottom')}
              className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                captionPos === 'bottom'
                  ? 'bg-white text-rausch shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
              title="Align captions at Bottom"
            >
              <AlignVerticalJustifyEnd className="w-3 h-3" />
              <span className="hidden sm:inline">Bot</span>
            </button>
          </div>
        )}
      </div>

      {/* Interactive Mobile Phone / Video Canvas Frame */}
      <div
        className={`relative w-full ${
          isLandscape
            ? 'max-w-[440px] aspect-[16/9]'
            : 'max-w-[280px] sm:max-w-[300px] aspect-[9/16]'
        } rounded-2xl overflow-hidden border-2 border-[#2b2b2b] bg-black shadow-airbnb select-none`}
      >
        {/* Instagram/Shorts-Style Segmented Top Progress Bars */}
        <div className="absolute top-2.5 inset-x-2.5 z-30 flex items-center gap-1">
          {scenes.map((s, idx) => {
            let widthPercent = 0;
            if (idx < activeSceneIndex) widthPercent = 100;
            else if (idx === activeSceneIndex) widthPercent = sceneProgress;
            else widthPercent = 0;

            return (
              <div
                key={idx}
                onClick={() => {
                  sceneElapsedRef.current = 0;
                  onSelectScene(idx);
                }}
                className="flex-1 h-1 bg-white/30 backdrop-blur-xs rounded-full overflow-hidden cursor-pointer hover:h-1.5 transition-all"
                title={`Jump to Scene ${idx + 1} (${s.duration.toFixed(1)}s)`}
              >
                <div
                  className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Top Badges (Scene & Layout Mode) */}
        <div className="absolute top-6 left-2.5 z-30 flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 text-white backdrop-blur-md border border-white/20">
            Scene {activeSceneIndex + 1}/{scenes.length}
          </span>
          {activeScene.isSplitScreen && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-white shadow-xs">
              ⚡ Split Screen
            </span>
          )}
          {activeScene.isHostScene && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-600 text-white shadow-xs">
              🎙️ Host
            </span>
          )}
        </div>

        {/* Background Visual Media Layer */}
        {activeScene.isSplitScreen && activeScene.hostAsset ? (
          /* Dual Split-Screen (Top: Host Video, Bottom: Stock Asset) */
          <div className="w-full h-full flex flex-col relative">
            {/* Top Half: Host Video */}
            <div className="h-1/2 w-full relative overflow-hidden bg-zinc-900 border-b-2 border-white/30">
              <video
                src={getMediaUrl(activeScene.hostAsset)}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/70 text-white backdrop-blur-xs border border-white/10">
                🎙️ Host Video
              </span>
            </div>

            {/* Bottom Half: Stock Image or Video */}
            <div className="h-1/2 w-full relative overflow-hidden bg-zinc-950">
              {isVideoAsset(activeScene.image) ? (
                <video
                  src={getMediaUrl(activeScene.image)}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={getMediaUrl(activeScene.image)}
                  alt={activeScene.keyword}
                  className="w-full h-full object-cover"
                />
              )}
              <span className="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/70 text-white backdrop-blur-xs border border-white/10">
                Visual Media
              </span>
            </div>
          </div>
        ) : isVideoAsset(activeScene.image) ? (
          /* Single Video Asset */
          <div className="w-full h-full relative overflow-hidden bg-black">
            <video
              src={getMediaUrl(activeScene.image)}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          /* Single Image Asset */
          <div className="w-full h-full relative overflow-hidden bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getMediaUrl(activeScene.image)}
              alt={activeScene.keyword}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Subtle Dark Vignette / Overlay Gradient for readability */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/60" />

        {/* --- LIVE OVERLAY LAYER 1: SPOKEN CAPTIONS --- */}
        {mediaSettings.textOverlayMode === 'captions' && (
          <div
            className={`absolute inset-x-3 z-20 flex flex-col items-center justify-center transition-all duration-300 pointer-events-none ${
              captionPos === 'top'
                ? 'top-12'
                : captionPos === 'middle'
                  ? 'top-1/2 -translate-y-1/2'
                  : 'bottom-10'
            }`}
          >
            {activeCaptionText ? (
              <div className="max-w-[90%] px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-center shadow-2xl animate-fadeIn">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <span className="text-base leading-none">{activeScene.emoji || '✨'}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-rausch">Spoken</span>
                </div>
                <p className="text-xs sm:text-sm font-extrabold text-white leading-tight drop-shadow-md">
                  {activeCaptionText}
                </p>
              </div>
            ) : activeScene.captions && activeScene.captions[0] ? (
              <div className="max-w-[90%] px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-center shadow-2xl">
                <p className="text-xs sm:text-sm font-extrabold text-white leading-tight drop-shadow-md">
                  {activeScene.captions[0].text}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* --- LIVE OVERLAY LAYER 2: KINETIC GRAPHIC MOTION --- */}
        {mediaSettings.textOverlayMode === 'graphics' && (activeGraphic || activeScene.graphics?.[0]) && (
          <div className="absolute inset-x-3 bottom-14 z-20 flex justify-center pointer-events-none">
            {(() => {
              const gfx = activeGraphic || activeScene.graphics?.[0];
              if (!gfx) return null;
              return (
                <div className="max-w-[90%] px-3.5 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-white/40 text-center shadow-2xl animate-fadeIn">
                  <div className="text-[10px] font-bold text-muted uppercase tracking-wider">
                    {gfx.prefixText || 'Key Takeaway'}
                  </div>
                  <div className="text-sm sm:text-base font-black uppercase text-rausch tracking-tight">
                    {gfx.heroWord}
                  </div>
                  {gfx.suffixText && (
                    <div className="text-[10px] font-semibold text-ink">
                      {gfx.suffixText}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* --- LIVE OVERLAY LAYER 3: DUA CARD --- */}
        {activeScene.duaInfo?.isDua && liveDuaCardSvg && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center p-2 pointer-events-none"
            dangerouslySetInnerHTML={{ __html: liveDuaCardSvg }}
          />
        )}
      </div>

      {/* Interactive Storyboard Scrubber & Controls */}
      <div className="w-full mt-4 flex flex-col gap-2.5">
        
        {/* Playback Controls & Scene Stepper */}
        <div className="flex items-center justify-between gap-2">
          
          {/* Previous Scene Button */}
          <button
            type="button"
            onClick={handlePrevScene}
            className="p-2 rounded-full border border-hairline bg-surface-soft hover:bg-white text-ink hover:text-rausch transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Previous Scene"
            aria-label="Previous Scene"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Center Play / Pause Orb */}
          <button
            type="button"
            onClick={handleTogglePlay}
            className={`px-5 py-2 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer ${
              isPlaying
                ? 'bg-ink text-white'
                : 'bg-rausch hover:bg-rausch-active text-white shadow-airbnb'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause Preview</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Storyboard</span>
              </>
            )}
          </button>

          {/* Next Scene Button */}
          <button
            type="button"
            onClick={handleNextScene}
            className="p-2 rounded-full border border-hairline bg-surface-soft hover:bg-white text-ink hover:text-rausch transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Next Scene"
            aria-label="Next Scene"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Scene Selector Pills */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1">
          {scenes.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                sceneElapsedRef.current = 0;
                onSelectScene(idx);
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                activeSceneIndex === idx
                  ? 'bg-rausch text-white shadow-xs scale-105'
                  : 'bg-surface-soft text-muted hover:text-ink hover:bg-white border border-hairline'
              }`}
            >
              Scene {idx + 1}
              {s.duaInfo?.isDua && <span className="ml-1">🤲</span>}
              {s.isSplitScreen && <span className="ml-1">⚡</span>}
            </button>
          ))}
        </div>

        {/* Primary CTA: Compile Shorts Video */}
        <div className="pt-2 border-t border-hairline-soft">
          <button
            type="button"
            onClick={onGenerateVideo}
            disabled={isGenerating}
            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
              isGenerating
                ? 'bg-surface-soft text-muted border border-hairline cursor-not-allowed'
                : 'bg-rausch hover:bg-rausch-active text-white shadow-airbnb active:scale-98'
            }`}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Compiling Short Video...</span>
              </>
            ) : (
              <>
                <Video className="w-4 h-4" />
                <span>Compile & Generate Video ({totalDuration.toFixed(0)}s)</span>
              </>
            )}
          </button>
        </div>

      </div>

    </section>
  );
}
