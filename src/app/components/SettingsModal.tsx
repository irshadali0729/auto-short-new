'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  AlertCircle, 
  Settings as SettingsIcon, 
  Layers, 
  Image as ImageIcon, 
  Film, 
  HardDrive, 
  Globe, 
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';

export type MediaSourceKey = 'unsplash' | 'pixabay' | 'pexels' | 'local';
export type MediaTypeFilter = 'only_videos' | 'only_images' | 'both';

export interface MediaSettings {
  sources: {
    unsplash: boolean;
    pixabay: boolean;
    pexels: boolean;
    local: boolean;
  };
  mediaType: MediaTypeFilter;
  enableGraphicMotion: boolean;
  zoomSpeed: number;
  transitionDuration: number;
}

export const DEFAULT_MEDIA_SETTINGS: MediaSettings = {
  sources: {
    unsplash: true,
    pixabay: true,
    pexels: true,
    local: true,
  },
  mediaType: 'both',
  enableGraphicMotion: true,
  zoomSpeed: 1.0,
  transitionDuration: 0.3,
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: MediaSettings;
  onSave: (newSettings: MediaSettings) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: SettingsModalProps) {
  // Local scratch state for form editing before confirming
  const [draftSources, setDraftSources] = useState(settings.sources);
  const [draftMediaType, setDraftMediaType] = useState<MediaTypeFilter>(settings.mediaType);
  const [draftEnableGraphicMotion, setDraftEnableGraphicMotion] = useState<boolean>(
    settings.enableGraphicMotion !== false
  );
  const [draftZoomSpeed, setDraftZoomSpeed] = useState<number>(
    typeof settings.zoomSpeed === 'number' ? settings.zoomSpeed : DEFAULT_MEDIA_SETTINGS.zoomSpeed
  );
  const [draftTransitionDuration, setDraftTransitionDuration] = useState<number>(
    typeof settings.transitionDuration === 'number' ? settings.transitionDuration : DEFAULT_MEDIA_SETTINGS.transitionDuration
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Sync draft state with external props on open
  useEffect(() => {
    if (isOpen) {
      setDraftSources(settings.sources);
      setDraftMediaType(settings.mediaType);
      setDraftEnableGraphicMotion(settings.enableGraphicMotion !== false);
      setDraftZoomSpeed(
        typeof settings.zoomSpeed === 'number' ? settings.zoomSpeed : DEFAULT_MEDIA_SETTINGS.zoomSpeed
      );
      setDraftTransitionDuration(
        typeof settings.transitionDuration === 'number' ? settings.transitionDuration : DEFAULT_MEDIA_SETTINGS.transitionDuration
      );
      setValidationError(null);
      // Focus management
      setTimeout(() => closeBtnRef.current?.focus(), 50);
    }
  }, [isOpen, settings]);

  // Keyboard accessibility: Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Validation: count how many sources are active
  const selectedSourcesCount = Object.values(draftSources).filter(Boolean).length;
  const isSourceSelectionValid = selectedSourcesCount > 0;

  const handleSourceToggle = (key: MediaSourceKey) => {
    const nextSources = {
      ...draftSources,
      [key]: !draftSources[key],
    };

    const nextCount = Object.values(nextSources).filter(Boolean).length;
    if (nextCount === 0) {
      setValidationError('At least one media source must be selected.');
    } else {
      setValidationError(null);
    }

    setDraftSources(nextSources);
  };

  const handleSave = () => {
    if (!isSourceSelectionValid) {
      setValidationError('At least one media source must be selected.');
      return;
    }

    onSave({
      sources: draftSources,
      mediaType: draftMediaType,
      enableGraphicMotion: draftEnableGraphicMotion,
      zoomSpeed: draftZoomSpeed,
      transitionDuration: draftTransitionDuration,
    });
    onClose();
  };

  const handleResetDefaults = () => {
    setDraftSources(DEFAULT_MEDIA_SETTINGS.sources);
    setDraftMediaType(DEFAULT_MEDIA_SETTINGS.mediaType);
    setDraftEnableGraphicMotion(DEFAULT_MEDIA_SETTINGS.enableGraphicMotion);
    setDraftZoomSpeed(DEFAULT_MEDIA_SETTINGS.zoomSpeed);
    setDraftTransitionDuration(DEFAULT_MEDIA_SETTINGS.transitionDuration);
    setValidationError(null);
  };

  const sourceCards = [
    {
      key: 'unsplash' as MediaSourceKey,
      label: 'Unsplash',
      tagline: 'High-res editorial & authentic photography',
      badge: 'API & Web',
      icon: Globe,
    },
    {
      key: 'pixabay' as MediaSourceKey,
      label: 'Pixabay',
      tagline: 'Diverse vector illustrations, photos & footage',
      badge: 'Community',
      icon: Sparkles,
    },
    {
      key: 'pexels' as MediaSourceKey,
      label: 'Pexels',
      tagline: 'Cinematic vertical short clips & stock images',
      badge: 'Curated',
      icon: Layers,
    },
    {
      key: 'local' as MediaSourceKey,
      label: 'Local images',
      tagline: 'Physical assets in local image-library/ directory',
      badge: 'Offline',
      icon: HardDrive,
    },
  ];

  const mediaTypeOptions = [
    {
      id: 'only_images' as MediaTypeFilter,
      label: 'Only images',
      description: 'Photos, stills, and illustrations',
      icon: ImageIcon,
    },
    {
      id: 'only_videos' as MediaTypeFilter,
      label: 'Only videos',
      description: 'Dynamic stock video clips and looping footage',
      icon: Film,
    },
    {
      id: 'both' as MediaTypeFilter,
      label: 'Both images and stock video footage',
      description: 'Intelligently mix static photos and dynamic video clips',
      icon: SlidersHorizontal,
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      aria-describedby="settings-dialog-desc"
    >
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div 
        ref={dialogRef}
        className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950/95 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 my-auto"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800/80 flex items-start justify-between gap-4 bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 id="settings-dialog-title" className="text-xl font-bold text-white tracking-tight">
                Media & Source Configuration
              </h2>
              <p id="settings-dialog-desc" className="text-xs text-zinc-400 mt-0.5">
                Customize where assets are fetched and what media types are utilized.
              </p>
            </div>
          </div>
          
          <button 
            ref={closeBtnRef}
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            aria-label="Close settings dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Validation Warning Alert */}
        {validationError && (
          <div 
            className="mx-6 mt-4 p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in duration-150"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="p-6 space-y-8 overflow-y-auto max-h-[calc(85vh-160px)]">
          
          {/* Section 1: Source Selection (Checkboxes) */}
          <fieldset className="space-y-3">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400" />
                Source Selection
              </legend>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${
                isSourceSelectionValid 
                  ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' 
                  : 'bg-red-500/10 text-red-300 border-red-500/30'
              }`}>
                {selectedSourcesCount} selected
              </span>
            </div>
            
            <p className="text-xs text-zinc-400">
              Select one or more repositories to source video backgrounds and matching imagery.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {sourceCards.map((src) => {
                const isChecked = draftSources[src.key];
                const IconComponent = src.icon;
                return (
                  <label
                    key={src.key}
                    htmlFor={`source-${src.key}`}
                    className={`relative flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                      isChecked
                        ? 'bg-purple-950/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                        : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/70'
                    }`}
                  >
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        id={`source-${src.key}`}
                        checked={isChecked}
                        onChange={() => handleSourceToggle(src.key)}
                        className="sr-only"
                        aria-checked={isChecked}
                      />
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isChecked 
                          ? 'bg-purple-600 border-purple-500 text-white' 
                          : 'border-zinc-700 bg-zinc-900'
                      }`}>
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>

                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-sm font-bold text-white flex items-center gap-1.5">
                          <IconComponent className={`w-3.5 h-3.5 ${isChecked ? 'text-purple-400' : 'text-zinc-400'}`} />
                          {src.label}
                        </span>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                          {src.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-tight">
                        {src.tagline}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Section 2: Media Type Filter (Radio Buttons / Toggle Group) */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Film className="w-4 h-4 text-purple-400" />
              Media Type Filter
            </legend>

            <p className="text-xs text-zinc-400">
              Filter the assets requested by the auto-matcher for each generated scene.
            </p>

            <div className="flex flex-col gap-2.5 pt-1" role="radiogroup" aria-label="Media Type Filter">
              {mediaTypeOptions.map((opt) => {
                const isSelected = draftMediaType === opt.id;
                const IconComponent = opt.icon;

                return (
                  <label
                    key={opt.id}
                    htmlFor={`media-type-${opt.id}`}
                    className={`relative flex items-center gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-purple-950/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                        : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/70'
                    }`}
                  >
                    <input
                      type="radio"
                      id={`media-type-${opt.id}`}
                      name="mediaTypeFilter"
                      value={opt.id}
                      checked={isSelected}
                      onChange={() => setDraftMediaType(opt.id)}
                      className="sr-only"
                    />

                    {/* Styled Radio Circle */}
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                      isSelected 
                        ? 'border-purple-500 bg-purple-500/20' 
                        : 'border-zinc-700 bg-zinc-900'
                    }`}>
                      {isSelected && (
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-grow min-w-0">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-purple-500/20 text-purple-300' : 'bg-zinc-800/80 text-zinc-400'}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <span className="text-sm font-bold text-white block">
                          {opt.label}
                        </span>
                        <span className="text-xs text-zinc-400 block mt-0.5">
                          {opt.description}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Section 3: Graphic Motion & Kinetic Overlays */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Graphic Motion & Kinetic Overlays
            </legend>

            <p className="text-xs text-zinc-400">
              Configure whether kinetic typography and emphasis graphic overlays are animated over the final video.
            </p>

            <label
              htmlFor="toggle-graphic-motion"
              className={`relative flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                draftEnableGraphicMotion
                  ? 'bg-purple-950/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                  : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/70'
              }`}
            >
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  id="toggle-graphic-motion"
                  checked={draftEnableGraphicMotion}
                  onChange={(e) => setDraftEnableGraphicMotion(e.target.checked)}
                  className="sr-only"
                  aria-checked={draftEnableGraphicMotion}
                />
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                  draftEnableGraphicMotion 
                    ? 'bg-purple-600 border-purple-500 text-white' 
                    : 'border-zinc-700 bg-zinc-900'
                }`}>
                  {draftEnableGraphicMotion && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-sm font-bold text-white flex items-center gap-1.5">
                    Graphic Motion
                  </span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                    draftEnableGraphicMotion
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700/50'
                  }`}>
                    {draftEnableGraphicMotion ? 'Used in video' : 'Not used'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  If checked, uses kinetic motion graphic overlays (gold gradients, dual-tone punchlines, and slide-up animations) over each scene. If unchecked, generates clean background footage without graphics.
                </p>
              </div>
            </label>
          </fieldset>

          {/* Section 4: Camera & Transition Dynamics */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-purple-400" />
              Camera Dynamics & Transitions
            </legend>

            <p className="text-xs text-zinc-400">
              Configure camera zooming motion across clips and crossfade transition timing between scenes.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Zoom Speed Card */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <label htmlFor="settings-zoom-speed" className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Zoom/Pan Speed
                  </label>
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-black tabular-nums">
                    {draftZoomSpeed.toFixed(1)}x
                  </span>
                </div>

                <input
                  id="settings-zoom-speed"
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.1"
                  value={draftZoomSpeed}
                  onChange={(e) => setDraftZoomSpeed(parseFloat(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500 outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
                  aria-valuemin={0.2}
                  aria-valuemax={2.0}
                  aria-valuenow={draftZoomSpeed}
                  aria-valuetext={`${draftZoomSpeed.toFixed(1)}x speed`}
                />

                <div className="flex justify-between text-[10px] text-zinc-500 font-semibold">
                  <span>0.2x (Subtle)</span>
                  <span>1.0x (Default)</span>
                  <span>2.0x (Dramatic)</span>
                </div>
              </div>

              {/* Transition Duration Card */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <label htmlFor="settings-transition-duration" className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Crossfade Duration
                  </label>
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-black tabular-nums">
                    {draftTransitionDuration.toFixed(1)}s
                  </span>
                </div>

                <input
                  id="settings-transition-duration"
                  type="range"
                  min="0.0"
                  max="1.5"
                  step="0.1"
                  value={draftTransitionDuration}
                  onChange={(e) => setDraftTransitionDuration(parseFloat(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500 outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
                  aria-valuemin={0.0}
                  aria-valuemax={1.5}
                  aria-valuenow={draftTransitionDuration}
                  aria-valuetext={`${draftTransitionDuration.toFixed(1)} seconds`}
                />

                <div className="flex justify-between text-[10px] text-zinc-500 font-semibold">
                  <span>0.0s (Hard Cut)</span>
                  <span>0.3s (Default)</span>
                  <span>1.5s (Slow Fade)</span>
                </div>
              </div>
            </div>
          </fieldset>

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors underline-offset-4 hover:underline"
          >
            Reset to defaults
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isSourceSelectionValid}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                !isSourceSelectionValid
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700/50'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:-translate-y-0.5'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              Save Preferences
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
