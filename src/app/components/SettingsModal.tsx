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
  SlidersHorizontal,
  MessageSquareText,
  Type,
  Smartphone,
  Monitor,
  Smile,
  BookOpen
} from 'lucide-react';

export type MediaSourceKey = 'unsplash' | 'pixabay' | 'pexels' | 'local';
export type MediaTypeFilter = 'only_videos' | 'only_images' | 'both';
export type TextOverlayMode = 'none' | 'captions' | 'graphics';
export type VideoAspectRatio = '9:16' | '16:9';
export type EmojiStyleOption = 'fluent' | 'apple' | 'twitter';
export type DuaCardThemeOption = 'cream' | 'light_grey' | 'white';

export interface MediaSettings {
  sources: {
    unsplash: boolean;
    pixabay: boolean;
    pexels: boolean;
    local: boolean;
  };
  mediaType: MediaTypeFilter;
  textOverlayMode: TextOverlayMode;
  enableGraphicMotion?: boolean;
  zoomSpeed: number;
  transitionDuration: number;
  useRelatableVisualSearch?: boolean;
  aspectRatio: VideoAspectRatio;
  enableEmojiCaptions?: boolean;
  emojiStyle?: EmojiStyleOption;
  enableDuaOverlay?: boolean;
  duaCardTheme?: DuaCardThemeOption;
}

export const DEFAULT_MEDIA_SETTINGS: MediaSettings = {
  sources: {
    unsplash: true,
    pixabay: true,
    pexels: true,
    local: true,
  },
  mediaType: 'both',
  textOverlayMode: 'captions',
  enableGraphicMotion: false,
  zoomSpeed: 1.0,
  transitionDuration: 0.3,
  useRelatableVisualSearch: true,
  aspectRatio: '9:16',
  enableEmojiCaptions: true,
  emojiStyle: 'fluent',
  enableDuaOverlay: true,
  duaCardTheme: 'cream',
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: MediaSettings;
  onSave: (newSettings: MediaSettings) => void;
}

function resolveOverlayMode(s: MediaSettings): TextOverlayMode {
  if (s.textOverlayMode) return s.textOverlayMode;
  if (s.enableGraphicMotion) return 'graphics';
  return 'captions';
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
  const [draftTextOverlayMode, setDraftTextOverlayMode] = useState<TextOverlayMode>(
    resolveOverlayMode(settings)
  );
  const [draftZoomSpeed, setDraftZoomSpeed] = useState<number>(
    typeof settings.zoomSpeed === 'number' ? settings.zoomSpeed : DEFAULT_MEDIA_SETTINGS.zoomSpeed
  );
  const [draftTransitionDuration, setDraftTransitionDuration] = useState<number>(
    typeof settings.transitionDuration === 'number' ? settings.transitionDuration : DEFAULT_MEDIA_SETTINGS.transitionDuration
  );
  const [draftRelatableVisualSearch, setDraftRelatableVisualSearch] = useState<boolean>(
    settings.useRelatableVisualSearch !== false
  );
  const [draftAspectRatio, setDraftAspectRatio] = useState<VideoAspectRatio>(
    settings.aspectRatio || DEFAULT_MEDIA_SETTINGS.aspectRatio
  );
  const [draftEnableEmojiCaptions, setDraftEnableEmojiCaptions] = useState<boolean>(
    settings.enableEmojiCaptions !== false
  );
  const [draftEmojiStyle, setDraftEmojiStyle] = useState<EmojiStyleOption>(
    settings.emojiStyle || DEFAULT_MEDIA_SETTINGS.emojiStyle || 'fluent'
  );
  const [draftEnableDuaOverlay, setDraftEnableDuaOverlay] = useState<boolean>(
    settings.enableDuaOverlay !== false
  );
  const [draftDuaCardTheme, setDraftDuaCardTheme] = useState<DuaCardThemeOption>(
    settings.duaCardTheme || DEFAULT_MEDIA_SETTINGS.duaCardTheme || 'cream'
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Sync draft state with external props on open
  useEffect(() => {
    if (isOpen) {
      setDraftSources(settings.sources);
      setDraftMediaType(settings.mediaType);
      setDraftTextOverlayMode(resolveOverlayMode(settings));
      setDraftZoomSpeed(
        typeof settings.zoomSpeed === 'number' ? settings.zoomSpeed : DEFAULT_MEDIA_SETTINGS.zoomSpeed
      );
      setDraftTransitionDuration(
        typeof settings.transitionDuration === 'number' ? settings.transitionDuration : DEFAULT_MEDIA_SETTINGS.transitionDuration
      );
      setDraftRelatableVisualSearch(settings.useRelatableVisualSearch !== false);
      setDraftAspectRatio(settings.aspectRatio || DEFAULT_MEDIA_SETTINGS.aspectRatio);
      setDraftEnableEmojiCaptions(settings.enableEmojiCaptions !== false);
      setDraftEmojiStyle(settings.emojiStyle || DEFAULT_MEDIA_SETTINGS.emojiStyle || 'fluent');
      setDraftEnableDuaOverlay(settings.enableDuaOverlay !== false);
      setDraftDuaCardTheme(settings.duaCardTheme || DEFAULT_MEDIA_SETTINGS.duaCardTheme || 'cream');
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
      textOverlayMode: draftTextOverlayMode,
      enableGraphicMotion: draftTextOverlayMode === 'graphics',
      zoomSpeed: draftZoomSpeed,
      transitionDuration: draftTransitionDuration,
      useRelatableVisualSearch: draftRelatableVisualSearch,
      aspectRatio: draftAspectRatio,
      enableEmojiCaptions: draftEnableEmojiCaptions,
      emojiStyle: draftEmojiStyle,
      enableDuaOverlay: draftEnableDuaOverlay,
      duaCardTheme: draftDuaCardTheme,
    });
    onClose();
  };

  const handleResetDefaults = () => {
    setDraftSources(DEFAULT_MEDIA_SETTINGS.sources);
    setDraftMediaType(DEFAULT_MEDIA_SETTINGS.mediaType);
    setDraftTextOverlayMode(DEFAULT_MEDIA_SETTINGS.textOverlayMode);
    setDraftZoomSpeed(DEFAULT_MEDIA_SETTINGS.zoomSpeed);
    setDraftTransitionDuration(DEFAULT_MEDIA_SETTINGS.transitionDuration);
    setDraftRelatableVisualSearch(DEFAULT_MEDIA_SETTINGS.useRelatableVisualSearch !== false);
    setDraftAspectRatio(DEFAULT_MEDIA_SETTINGS.aspectRatio);
    setDraftEnableEmojiCaptions(DEFAULT_MEDIA_SETTINGS.enableEmojiCaptions !== false);
    setDraftEmojiStyle(DEFAULT_MEDIA_SETTINGS.emojiStyle || 'fluent');
    setDraftEnableDuaOverlay(DEFAULT_MEDIA_SETTINGS.enableDuaOverlay !== false);
    setDraftDuaCardTheme(DEFAULT_MEDIA_SETTINGS.duaCardTheme || 'cream');
    setValidationError(null);
  };

  const emojiStyleOptions = [
    {
      id: 'fluent' as EmojiStyleOption,
      label: '3D Fluent Style',
      tagline: 'Glossy 3D emojis (Submagic & CapCut viral style)',
      badge: 'Recommended',
      preview: '💔',
    },
    {
      id: 'apple' as EmojiStyleOption,
      label: 'Apple iOS Style',
      tagline: 'High-definition Apple style emoji aesthetics',
      badge: 'Classic',
      preview: '✨',
    },
    {
      id: 'twitter' as EmojiStyleOption,
      label: 'Flat Vector Style',
      tagline: 'Clean 2D Twemoji vector illustrations',
      badge: 'Minimal',
      preview: '🤲',
    },
  ];

  const duaThemeOptions = [
    {
      id: 'cream' as DuaCardThemeOption,
      label: 'Cream & Warm Ivory',
      tagline: 'Warm ivory parchment with soft gold accents and emerald script',
      badge: 'Recommended',
      colorPreview: '#FAF6ED',
      borderPreview: '#E2D3B3',
    },
    {
      id: 'white' as DuaCardThemeOption,
      label: 'Pure White & Gold',
      tagline: 'Pristine white card with crisp high-contrast calligraphy',
      badge: 'Minimal Luxe',
      colorPreview: '#FFFFFF',
      borderPreview: '#E5E7EB',
    },
    {
      id: 'light_grey' as DuaCardThemeOption,
      label: 'Light Grey & Slate',
      tagline: 'Subtle slate soft background with deep navy Arabic accents',
      badge: 'Modern',
      colorPreview: '#F4F6F8',
      borderPreview: '#CBD5E1',
    },
  ];

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

  const aspectRatioOptions: {
    id: VideoAspectRatio;
    label: string;
    badge: string;
    resolution: string;
    description: string;
    icon: React.ElementType;
  }[] = [
    {
      id: '9:16',
      label: '9:16 Vertical (Shorts & Reels)',
      badge: 'Default (Shorts & Reels)',
      resolution: '1080 × 1920',
      description: 'Full-screen portrait format optimized for YouTube Shorts, Instagram Reels, and TikTok feeds.',
      icon: Smartphone,
    },
    {
      id: '16:9',
      label: '16:9 Landscape (Widescreen)',
      badge: 'YouTube Desktop',
      resolution: '1920 × 1080',
      description: 'Standard widescreen horizontal format for traditional YouTube desktop and landscape video players.',
      icon: Monitor,
    },
  ];

  const overlayModeOptions: {
    id: TextOverlayMode;
    label: string;
    badge: string;
    description: string;
    icon: React.ElementType;
  }[] = [
    {
      id: 'captions',
      label: 'Spoken Captions Only',
      badge: 'Recommended',
      description: 'Displays clean spoken subtitles synchronized with the audio speech timeline in the lower third.',
      icon: MessageSquareText,
    },
    {
      id: 'graphics',
      label: 'Graphic Motion Only',
      badge: 'Kinetic',
      description: 'Displays dynamic animated hero typography (gold gradients, dual-tone punchlines, and slide-up animations).',
      icon: Sparkles,
    },
    {
      id: 'none',
      label: 'None (Clean Video)',
      badge: 'Pure Footage',
      description: 'Generates clean background video and photo imagery with zero on-screen text overlays.',
      icon: Film,
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
      {/* Backdrop overlay (50% scrim from DESIGN.md) */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div 
        ref={dialogRef}
        className="relative w-full max-w-2xl rounded-2xl border border-hairline bg-white shadow-airbnb flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 my-auto"
      >
        {/* Header */}
        <div className="p-6 border-b border-hairline-soft flex items-start justify-between gap-4 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-[#fff0f2] text-rausch">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 id="settings-dialog-title" className="text-xl font-bold text-ink tracking-tight">
                Media & Source Configuration
              </h2>
              <p id="settings-dialog-desc" className="text-xs text-muted mt-0.5">
                Customize where assets are fetched and what media types are utilized.
              </p>
            </div>
          </div>
          
          <button 
            ref={closeBtnRef}
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white border border-hairline text-ink hover:bg-surface-soft transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ink"
            aria-label="Close settings dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Validation Warning Alert */}
        {validationError && (
          <div 
            className="mx-6 mt-4 p-3.5 rounded-xl border border-red-200 bg-[#fff5f5] text-[#c13515] flex items-center gap-2.5 text-xs font-semibold animate-in fade-in duration-150"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="p-6 space-y-7 overflow-y-auto max-h-[calc(85vh-160px)]">
          
          {/* Section 1: Source Selection (Checkboxes) */}
          <fieldset className="space-y-3">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-rausch" />
                Source Selection
              </legend>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                isSourceSelectionValid 
                  ? 'bg-surface-soft text-ink border-hairline' 
                  : 'bg-red-50 text-[#c13515] border-red-200'
              }`}>
                {selectedSourcesCount} selected
              </span>
            </div>
            
            <p className="text-xs text-muted">
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
                        ? 'bg-[#fff8f9] border-rausch shadow-airbnb'
                        : 'bg-white border-hairline hover:border-border-strong hover:bg-surface-soft'
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
                          ? 'bg-rausch border-rausch text-white' 
                          : 'border-hairline bg-white'
                      }`}>
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>

                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                          <IconComponent className={`w-3.5 h-3.5 ${isChecked ? 'text-rausch' : 'text-muted'}`} />
                          {src.label}
                        </span>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-surface-soft text-muted border border-hairline-soft">
                          {src.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted leading-tight">
                        {src.tagline}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Section: AI Visual Search & Matching Engine (Toggle Flag) */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rausch" />
              AI Visual Search Engine
            </legend>

            <p className="text-xs text-muted">
              Configure how script scenes are translated into stock queries. You can disable this to immediately fall back to the legacy keyword matching.
            </p>

            <label
              htmlFor="relatable-visual-search-toggle"
              className={`relative flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                draftRelatableVisualSearch
                  ? 'bg-[#fff8f9] border-rausch shadow-airbnb'
                  : 'bg-white border-hairline hover:border-border-strong hover:bg-surface-soft'
              }`}
            >
              <div className="pt-0.5 shrink-0">
                <input
                  type="checkbox"
                  id="relatable-visual-search-toggle"
                  checked={draftRelatableVisualSearch}
                  onChange={(e) => setDraftRelatableVisualSearch(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                    draftRelatableVisualSearch
                      ? 'border-rausch bg-rausch text-white'
                      : 'border-hairline bg-white'
                  }`}
                >
                  {draftRelatableVisualSearch && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-bold text-ink flex items-center gap-2">
                    Relatable Visual Search & Multi-Tier Matching
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                      draftRelatableVisualSearch
                        ? 'bg-[#fff0f2] text-rausch border-[#ffd1da]'
                        : 'bg-surface-soft text-muted border-hairline-soft'
                    }`}
                  >
                    {draftRelatableVisualSearch ? 'Recommended (v2.0)' : 'Legacy Mode'}
                  </span>
                </div>

                <p className="text-xs text-muted leading-relaxed">
                  Translates spiritual and metaphorical phrases into concrete, photogenic camera shots (e.g. converting heartache into thoughtful cinematic lighting) and cascades through primary, secondary, and mood queries to prevent random fallbacks.
                </p>

                <div className="mt-2.5 pt-2 border-t border-hairline-soft flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                  <span>
                    {draftRelatableVisualSearch ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                        Active: Metaphor Mapping & Cascading Fallback (Tier 1 &rarr; 4)
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block shrink-0" />
                        Active: Legacy Single-Keyword Matching
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-muted italic">
                    Uncheck to switch to old implementation
                  </span>
                </div>
              </div>
            </label>
          </fieldset>

          {/* Section: Video Canvas & Aspect Ratio */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-rausch" />
              Video Canvas & Aspect Ratio
            </legend>

            <p className="text-xs text-muted">
              Choose the target format for video and photo assets. YouTube Shorts require 9:16 vertical full-screen.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1" role="radiogroup" aria-label="Video Aspect Ratio">
              {aspectRatioOptions.map((opt) => {
                const isSelected = draftAspectRatio === opt.id;
                const IconComponent = opt.icon;

                return (
                  <label
                    key={opt.id}
                    htmlFor={`aspect-ratio-${opt.id}`}
                    className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-[#fff8f9] border-rausch shadow-airbnb'
                        : 'bg-white border-hairline hover:border-border-strong hover:bg-surface-soft'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-[#fff0f2] text-rausch' : 'bg-surface-soft text-muted'}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-ink block leading-tight">
                            {opt.id}
                          </span>
                          <span className="text-[11px] font-semibold text-muted">
                            {opt.resolution}
                          </span>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                        isSelected 
                          ? 'border-rausch bg-rausch' 
                          : 'border-hairline bg-white'
                      }`}>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                    </div>

                    <input
                      type="radio"
                      id={`aspect-ratio-${opt.id}`}
                      name="videoAspectRatio"
                      value={opt.id}
                      checked={isSelected}
                      onChange={() => setDraftAspectRatio(opt.id)}
                      className="sr-only"
                    />

                    <div>
                      <span className={`inline-block text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border mb-1.5 ${
                        isSelected
                          ? 'bg-[#fff0f2] text-rausch border-[#ffd1da]'
                          : 'bg-surface-soft text-muted border-hairline-soft'
                      }`}>
                        {opt.badge}
                      </span>
                      <p className="text-xs text-muted leading-tight">
                        {opt.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Section 2: Media Type Filter (Radio Buttons / Toggle Group) */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <Film className="w-4 h-4 text-rausch" />
              Media Type Filter
            </legend>

            <p className="text-xs text-muted">
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
                        ? 'bg-[#fff8f9] border-rausch shadow-airbnb'
                        : 'bg-white border-hairline hover:border-border-strong hover:bg-surface-soft'
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
                        ? 'border-rausch bg-rausch' 
                        : 'border-hairline bg-white'
                    }`}>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-grow min-w-0">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-[#fff0f2] text-rausch' : 'bg-surface-soft text-muted'}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <span className="text-sm font-bold text-ink block">
                          {opt.label}
                        </span>
                        <span className="text-xs text-muted block mt-0.5">
                          {opt.description}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Section 3: On-Screen Text & Motion Overlays (Mutually Exclusive) */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <Type className="w-4 h-4 text-rausch" />
              On-Screen Text & Motion Overlays
            </legend>

            <p className="text-xs text-muted">
              Choose how on-screen text is presented. Captions and graphic motion are mutually exclusive and will never be displayed together.
            </p>

            <div className="flex flex-col gap-2.5 pt-1" role="radiogroup" aria-label="Text Overlay Mode">
              {overlayModeOptions.map((opt) => {
                const isSelected = draftTextOverlayMode === opt.id;
                const IconComponent = opt.icon;

                return (
                  <label
                    key={opt.id}
                    htmlFor={`overlay-mode-${opt.id}`}
                    className={`relative flex items-center gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-[#fff8f9] border-rausch shadow-airbnb'
                        : 'bg-white border-hairline hover:border-border-strong hover:bg-surface-soft'
                    }`}
                  >
                    <input
                      type="radio"
                      id={`overlay-mode-${opt.id}`}
                      name="textOverlayMode"
                      value={opt.id}
                      checked={isSelected}
                      onChange={() => setDraftTextOverlayMode(opt.id)}
                      className="sr-only"
                    />

                    {/* Styled Radio Circle */}
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                      isSelected 
                        ? 'border-rausch bg-rausch' 
                        : 'border-hairline bg-white'
                    }`}>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-grow min-w-0">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-[#fff0f2] text-rausch' : 'bg-surface-soft text-muted'}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-sm font-bold text-ink block">
                            {opt.label}
                          </span>
                          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                            isSelected
                              ? 'bg-[#fff0f2] text-rausch border-[#ffd1da]'
                              : 'bg-surface-soft text-muted border-hairline-soft'
                          }`}>
                            {opt.badge}
                          </span>
                        </div>
                        <span className="text-xs text-muted block leading-tight">
                          {opt.description}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Section: Viral Captions & 3D Emojis */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <Smile className="w-4 h-4 text-rausch" />
              Viral Captions & 3D Emojis
            </legend>

            <p className="text-xs text-muted">
              Display high-impact 3D emojis positioned gracefully above subtitle captions to maximize viewer retention and emotional resonance.
            </p>

            {/* Toggle Card */}
            <label className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
              draftEnableEmojiCaptions
                ? 'bg-[#fff8f9] border-rausch shadow-airbnb'
                : 'bg-white border-hairline hover:border-border-strong hover:bg-surface-soft'
            }`}>
              <input
                type="checkbox"
                checked={draftEnableEmojiCaptions}
                onChange={(e) => setDraftEnableEmojiCaptions(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                draftEnableEmojiCaptions
                  ? 'border-rausch bg-rausch text-white'
                  : 'border-hairline bg-white'
              }`}>
                {draftEnableEmojiCaptions && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-sm font-bold text-ink">
                    Enable 3D Emoji Overlays in Captions
                  </span>
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                    draftEnableEmojiCaptions
                      ? 'bg-[#fff0f2] text-rausch border-[#ffd1da]'
                      : 'bg-surface-soft text-muted border-hairline-soft'
                  }`}>
                    {draftEnableEmojiCaptions ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-muted leading-tight">
                  Automatically pairs scenes and subtitles with relevant emotional 3D emojis (e.g., 💔, 🤲, ⏳, 🔥, ✨).
                </p>
              </div>
            </label>

            {/* Emoji Style Selection */}
            {draftEnableEmojiCaptions && (
              <div className="pt-1">
                <span className="text-xs font-bold text-ink block mb-2">
                  Emoji Rendering Aesthetics
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {emojiStyleOptions.map((opt) => {
                    const isSelected = draftEmojiStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDraftEmojiStyle(opt.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#fff0f2] border-rausch shadow-sm'
                            : 'bg-white border-hairline hover:bg-surface-soft hover:border-border-strong'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-xl">{opt.preview}</span>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-rausch text-white'
                              : 'bg-surface-soft text-muted'
                          }`}>
                            {opt.badge}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-ink block leading-tight">
                            {opt.label}
                          </span>
                          <span className="text-[10px] text-muted block mt-0.5 leading-tight">
                            {opt.tagline}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </fieldset>

          {/* Section: Spiritual Highlights & Dua Overlays */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-rausch" />
              Spiritual Highlights & Dua Overlays
            </legend>

            <p className="text-xs text-muted">
              Detect Quranic & Hadith Duas in the transcript, auto-correct Hindi and Arabic text using AI, and render a dedicated Islamic prayer card overlay.
            </p>

            {/* Toggle Card */}
            <label className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
              draftEnableDuaOverlay
                ? 'bg-[#fff8f9] border-rausch shadow-airbnb'
                : 'bg-white border-hairline hover:border-border-strong hover:bg-surface-soft'
            }`}>
              <input
                type="checkbox"
                checked={draftEnableDuaOverlay}
                onChange={(e) => setDraftEnableDuaOverlay(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                draftEnableDuaOverlay
                  ? 'border-rausch bg-rausch text-white'
                  : 'border-hairline bg-white'
              }`}>
                {draftEnableDuaOverlay && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-sm font-bold text-ink">
                    Enable Dua Detection & Card Overlay
                  </span>
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                    draftEnableDuaOverlay
                      ? 'bg-[#fff0f2] text-rausch border-[#ffd1da]'
                      : 'bg-surface-soft text-muted border-hairline-soft'
                  }`}>
                    {draftEnableDuaOverlay ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-muted leading-tight">
                  When a Dua is spoken, replaces standard subtitles with a refined prayer card in Hindi and Arabic with Tashkeel.
                </p>
              </div>
            </label>

            {/* Dua Card Theme Selection */}
            {draftEnableDuaOverlay && (
              <div className="pt-1">
                <span className="text-xs font-bold text-ink block mb-2">
                  Dua Card Color Aesthetics
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {duaThemeOptions.map((opt) => {
                    const isSelected = draftDuaCardTheme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDraftDuaCardTheme(opt.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#fff0f2] border-rausch shadow-sm'
                            : 'bg-white border-hairline hover:bg-surface-soft hover:border-border-strong'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <div
                            className="w-5 h-5 rounded-md border shadow-inner"
                            style={{
                              backgroundColor: opt.colorPreview,
                              borderColor: opt.borderPreview,
                            }}
                          />
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-rausch text-white'
                              : 'bg-surface-soft text-muted'
                          }`}>
                            {opt.badge}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-ink block leading-tight">
                            {opt.label}
                          </span>
                          <span className="text-[10px] text-muted block mt-0.5 leading-tight">
                            {opt.tagline}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </fieldset>

          {/* Section 4: Camera & Transition Dynamics */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-rausch" />
              Camera Dynamics & Transitions
            </legend>

            <p className="text-xs text-muted">
              Configure camera zooming motion across clips and crossfade transition timing between scenes.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Zoom Speed Card */}
              <div className="p-4 rounded-xl border border-hairline bg-surface-soft/60 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <label htmlFor="settings-zoom-speed" className="text-xs font-bold text-ink uppercase tracking-wider">
                    Zoom/Pan Speed
                  </label>
                  <span className="px-2 py-0.5 rounded-md bg-[#fff0f2] border border-[#ffd1da] text-rausch text-xs font-bold tabular-nums">
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
                  className="w-full h-2 bg-hairline rounded-lg appearance-none cursor-pointer accent-[#ff385c] outline-none focus-visible:ring-2 focus-visible:ring-rausch"
                  aria-valuemin={0.2}
                  aria-valuemax={2.0}
                  aria-valuenow={draftZoomSpeed}
                  aria-valuetext={`${draftZoomSpeed.toFixed(1)}x speed`}
                />

                <div className="flex justify-between text-[10px] text-muted font-medium">
                  <span>0.2x (Subtle)</span>
                  <span>1.0x (Default)</span>
                  <span>2.0x (Dramatic)</span>
                </div>
              </div>

              {/* Transition Duration Card */}
              <div className="p-4 rounded-xl border border-hairline bg-surface-soft/60 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <label htmlFor="settings-transition-duration" className="text-xs font-bold text-ink uppercase tracking-wider">
                    Crossfade Duration
                  </label>
                  <span className="px-2 py-0.5 rounded-md bg-[#fff0f2] border border-[#ffd1da] text-rausch text-xs font-bold tabular-nums">
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
                  className="w-full h-2 bg-hairline rounded-lg appearance-none cursor-pointer accent-[#ff385c] outline-none focus-visible:ring-2 focus-visible:ring-rausch"
                  aria-valuemin={0.0}
                  aria-valuemax={1.5}
                  aria-valuenow={draftTransitionDuration}
                  aria-valuetext={`${draftTransitionDuration.toFixed(1)} seconds`}
                />

                <div className="flex justify-between text-[10px] text-muted font-medium">
                  <span>0.0s (Hard Cut)</span>
                  <span>0.3s (Default)</span>
                  <span>1.5s (Slow Fade)</span>
                </div>
              </div>
            </div>
          </fieldset>

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-hairline-soft bg-white flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs font-semibold text-muted hover:text-ink transition-colors underline-offset-4 hover:underline"
          >
            Reset to defaults
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-hairline bg-white text-xs font-bold text-ink hover:bg-surface-soft transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isSourceSelectionValid}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                !isSourceSelectionValid
                  ? 'bg-rausch-disabled text-white cursor-not-allowed'
                  : 'bg-rausch hover:bg-rausch-active text-white'
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
