"use client";

import React, { useState, useEffect, useRef } from "react";
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
  BookOpen,
  UserCheck,
  History,
  Server,
  Laptop,
} from "lucide-react";
import { useFocusTrap } from "@/app/utils/useFocusTrap";
import SettingsAccordionSection from "@/app/components/settings/SettingsAccordionSection";
import { getMediaUrl } from "@/app/utils/media-url";
import type { GraphicMotionThemeOption } from "@/app/types/scene";

export type { GraphicMotionThemeOption } from "@/app/types/scene";

export type MediaSourceKey = "unsplash" | "pixabay" | "pexels" | "local";
export type MediaTypeFilter = "only_videos" | "only_images" | "both";
export type TextOverlayMode = "none" | "captions" | "graphics";
export type CaptionPosition = "top" | "middle" | "bottom";
export type CaptionThemeOption =
  | "pill"
  | "bold_outline"
  | "gradient_highlight"
  | "pill_translucent";
export type VideoAspectRatio = "9:16" | "16:9";
export type EmojiStyleOption = "fluent" | "apple" | "twitter";
export type DuaCardThemeOption = "cream" | "light_grey" | "white";
export type HistoryStorageMode = "server" | "local";

interface AvatarPickerOption {
  id: string;
  category: string;
  thumbnail: string | null;
  videoCount: number;
}

export interface MediaSettings {
  sources: {
    unsplash: boolean;
    pixabay: boolean;
    pexels: boolean;
    local: boolean;
  };
  saveOnlineMediaToDisk?: boolean;
  mediaType: MediaTypeFilter;
  textOverlayMode: TextOverlayMode;
  captionPosition?: CaptionPosition;
  captionTheme?: CaptionThemeOption;
  enableGraphicMotion?: boolean;
  graphicMotionTheme?: GraphicMotionThemeOption;
  zoomSpeed: number;
  transitionDuration: number;
  useRelatableVisualSearch?: boolean;
  aspectRatio: VideoAspectRatio;
  enableEmojiCaptions?: boolean;
  emojiStyle?: EmojiStyleOption;
  enableDuaOverlay?: boolean;
  duaCardTheme?: DuaCardThemeOption;
  enableAvatarHost?: boolean;
  avatarCategory?: string;
  avatarId?: string;
  saveHistoryEnabled?: boolean;
  historyStorageMode?: HistoryStorageMode;
}

export const DEFAULT_MEDIA_SETTINGS: MediaSettings = {
  sources: {
    unsplash: true,
    pixabay: false,
    pexels: false,
    local: true,
  },
  saveOnlineMediaToDisk: true,
  mediaType: "only_images",
  textOverlayMode: "captions",
  captionPosition: "top",
  captionTheme: "pill",
  enableGraphicMotion: false,
  graphicMotionTheme: "auto",
  zoomSpeed: 2,
  transitionDuration: 0.3,
  useRelatableVisualSearch: true,
  aspectRatio: "9:16",
  enableEmojiCaptions: false,
  emojiStyle: "fluent",
  enableDuaOverlay: false,
  duaCardTheme: "cream",
  enableAvatarHost: false,
  avatarCategory: "women_avatars",
  avatarId: "Avatar-1",
  saveHistoryEnabled: true,
  historyStorageMode: "server",
};


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: MediaSettings;
  onSave: (newSettings: MediaSettings) => void;
}

function resolveOverlayMode(s: MediaSettings): TextOverlayMode {
  if (s.textOverlayMode) return s.textOverlayMode;
  if (s.enableGraphicMotion) return "graphics";
  return "captions";
}

// Sections that are expanded by default when the modal opens — the settings
// users tend to touch most often.
const DEFAULT_OPEN_SECTIONS = ["sources", "aspectRatio", "overlayMode"];

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: SettingsModalProps) {
  const safeInitialSources = settings?.sources
    ? { ...DEFAULT_MEDIA_SETTINGS.sources, ...settings.sources }
    : DEFAULT_MEDIA_SETTINGS.sources;

  // Local scratch state for form editing before confirming
  const [draftSources, setDraftSources] = useState(safeInitialSources);
  const [draftMediaType, setDraftMediaType] = useState<MediaTypeFilter>(
    settings?.mediaType || DEFAULT_MEDIA_SETTINGS.mediaType,
  );
  const [draftTextOverlayMode, setDraftTextOverlayMode] =
    useState<TextOverlayMode>(
      resolveOverlayMode(settings || DEFAULT_MEDIA_SETTINGS),
    );
  const [draftCaptionPosition, setDraftCaptionPosition] =
    useState<CaptionPosition>(
      settings?.captionPosition ||
        DEFAULT_MEDIA_SETTINGS.captionPosition ||
        "bottom",
    );
  const [draftCaptionTheme, setDraftCaptionTheme] =
    useState<CaptionThemeOption>(
      settings?.captionTheme || DEFAULT_MEDIA_SETTINGS.captionTheme || "pill",
    );
  const [draftGraphicMotionTheme, setDraftGraphicMotionTheme] =
    useState<GraphicMotionThemeOption>(
      settings?.graphicMotionTheme ||
        DEFAULT_MEDIA_SETTINGS.graphicMotionTheme ||
        "auto",
    );
  const [draftZoomSpeed, setDraftZoomSpeed] = useState<number>(
    typeof settings?.zoomSpeed === "number"
      ? settings.zoomSpeed
      : DEFAULT_MEDIA_SETTINGS.zoomSpeed,
  );
  const [draftTransitionDuration, setDraftTransitionDuration] =
    useState<number>(
      typeof settings?.transitionDuration === "number"
        ? settings.transitionDuration
        : DEFAULT_MEDIA_SETTINGS.transitionDuration,
    );
  const [draftRelatableVisualSearch, setDraftRelatableVisualSearch] =
    useState<boolean>(settings?.useRelatableVisualSearch !== false);
  const [draftAspectRatio, setDraftAspectRatio] = useState<VideoAspectRatio>(
    settings?.aspectRatio || DEFAULT_MEDIA_SETTINGS.aspectRatio,
  );
  const [draftEnableEmojiCaptions, setDraftEnableEmojiCaptions] =
    useState<boolean>(settings?.enableEmojiCaptions !== false);
  const [draftEmojiStyle, setDraftEmojiStyle] = useState<EmojiStyleOption>(
    settings?.emojiStyle || DEFAULT_MEDIA_SETTINGS.emojiStyle || "fluent",
  );
  const [draftEnableDuaOverlay, setDraftEnableDuaOverlay] = useState<boolean>(
    settings?.enableDuaOverlay !== false,
  );
  const [draftDuaCardTheme, setDraftDuaCardTheme] =
    useState<DuaCardThemeOption>(
      settings?.duaCardTheme || DEFAULT_MEDIA_SETTINGS.duaCardTheme || "cream",
    );
  const [draftSaveOnlineMediaToDisk, setDraftSaveOnlineMediaToDisk] =
    useState<boolean>(settings?.saveOnlineMediaToDisk !== false);
  const [draftEnableAvatarHost, setDraftEnableAvatarHost] = useState<boolean>(
    settings?.enableAvatarHost !== false,
  );
  const [draftAvatarCategory, setDraftAvatarCategory] = useState<string>(
    settings?.avatarCategory ||
      DEFAULT_MEDIA_SETTINGS.avatarCategory ||
      "women_avatars",
  );
  const [draftAvatarId, setDraftAvatarId] = useState<string>(
    settings?.avatarId || DEFAULT_MEDIA_SETTINGS.avatarId || "Avatar-1",
  );
  const [draftSaveHistoryEnabled, setDraftSaveHistoryEnabled] =
    useState<boolean>(settings?.saveHistoryEnabled !== false);
  const [draftHistoryStorageMode, setDraftHistoryStorageMode] =
    useState<HistoryStorageMode>(
      settings?.historyStorageMode ||
        DEFAULT_MEDIA_SETTINGS.historyStorageMode ||
        "server",
    );
  const [avatarOptions, setAvatarOptions] = useState<AvatarPickerOption[]>([]);
  const [avatarOptionsLoading, setAvatarOptionsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(DEFAULT_OPEN_SECTIONS),
  );
  const [activeNavId, setActiveNavId] = useState<string>("sources");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollTargetRef = useRef<string | null>(null);

  // Keep Tab/Shift+Tab cycling inside the dialog while it's open. Initial
  // focus is handled separately below (closeBtnRef), so pass it through here
  // too — otherwise the trap would steal focus onto its own default target.
  useFocusTrap(isOpen, dialogRef, closeBtnRef);

  // Sync draft state with external props on open
  useEffect(() => {
    if (isOpen) {
      const currentSources = settings?.sources
        ? { ...DEFAULT_MEDIA_SETTINGS.sources, ...settings.sources }
        : DEFAULT_MEDIA_SETTINGS.sources;
      setDraftSources(currentSources);
      setDraftSaveOnlineMediaToDisk(settings?.saveOnlineMediaToDisk !== false);
      setDraftMediaType(
        settings?.mediaType || DEFAULT_MEDIA_SETTINGS.mediaType,
      );
      setDraftTextOverlayMode(
        resolveOverlayMode(settings || DEFAULT_MEDIA_SETTINGS),
      );
      setDraftCaptionPosition(
        settings?.captionPosition ||
          DEFAULT_MEDIA_SETTINGS.captionPosition ||
          "bottom",
      );
      setDraftCaptionTheme(
        settings?.captionTheme || DEFAULT_MEDIA_SETTINGS.captionTheme || "pill",
      );
      setDraftGraphicMotionTheme(
        settings?.graphicMotionTheme ||
          DEFAULT_MEDIA_SETTINGS.graphicMotionTheme ||
          "auto",
      );
      setDraftZoomSpeed(
        typeof settings?.zoomSpeed === "number"
          ? settings.zoomSpeed
          : DEFAULT_MEDIA_SETTINGS.zoomSpeed,
      );
      setDraftTransitionDuration(
        typeof settings?.transitionDuration === "number"
          ? settings.transitionDuration
          : DEFAULT_MEDIA_SETTINGS.transitionDuration,
      );
      setDraftRelatableVisualSearch(
        settings?.useRelatableVisualSearch !== false,
      );
      setDraftAspectRatio(
        settings?.aspectRatio || DEFAULT_MEDIA_SETTINGS.aspectRatio,
      );
      setDraftEnableEmojiCaptions(settings?.enableEmojiCaptions !== false);
      setDraftEmojiStyle(
        settings?.emojiStyle || DEFAULT_MEDIA_SETTINGS.emojiStyle || "fluent",
      );
      setDraftEnableDuaOverlay(settings?.enableDuaOverlay !== false);
      setDraftDuaCardTheme(
        settings?.duaCardTheme ||
          DEFAULT_MEDIA_SETTINGS.duaCardTheme ||
          "cream",
      );
      setDraftEnableAvatarHost(settings?.enableAvatarHost !== false);
      setDraftAvatarCategory(
        settings?.avatarCategory ||
          DEFAULT_MEDIA_SETTINGS.avatarCategory ||
          "women_avatars",
      );
      setDraftAvatarId(
        settings?.avatarId || DEFAULT_MEDIA_SETTINGS.avatarId || "Avatar-1",
      );
      setDraftSaveHistoryEnabled(settings?.saveHistoryEnabled !== false);
      setDraftHistoryStorageMode(
        settings?.historyStorageMode ||
          DEFAULT_MEDIA_SETTINGS.historyStorageMode ||
          "server",
      );
      setValidationError(null);
      setOpenSections(new Set(DEFAULT_OPEN_SECTIONS));
      setActiveNavId("sources");
      // Focus management
      setTimeout(() => closeBtnRef.current?.focus(), 50);
    }
  }, [isOpen, settings]);

  // Fetch the available avatar thumbnails for the picker whenever the modal
  // opens or the selected avatar category changes.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setAvatarOptionsLoading(true);
    fetch(`/api/list-avatars?category=${encodeURIComponent(draftAvatarCategory)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAvatarOptions(data.avatars || []);
      })
      .catch(() => {
        if (!cancelled) setAvatarOptions([]);
      })
      .finally(() => {
        if (!cancelled) setAvatarOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, draftAvatarCategory]);

  // Keyboard accessibility: Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Once a targeted section has been expanded, scroll it into view.
  useEffect(() => {
    const targetId = scrollTargetRef.current;
    if (targetId && openSections.has(targetId)) {
      scrollTargetRef.current = null;
      requestAnimationFrame(() => {
        sectionRefs.current[targetId]?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [openSections]);

  if (!isOpen) return null;

  // Validation: count how many sources are active
  const selectedSourcesCount = Object.values(draftSources || {}).filter(
    Boolean,
  ).length;
  const isSourceSelectionValid = selectedSourcesCount > 0;

  const handleSourceToggle = (key: MediaSourceKey) => {
    const nextSources = {
      ...(draftSources || DEFAULT_MEDIA_SETTINGS.sources),
      [key]: !draftSources?.[key],
    };

    const nextCount = Object.values(nextSources).filter(Boolean).length;
    if (nextCount === 0) {
      setValidationError("At least one media source must be selected.");
    } else {
      setValidationError(null);
    }

    setDraftSources(nextSources);
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const jumpToSection = (id: string) => {
    setActiveNavId(id);
    scrollTargetRef.current = id;
    setOpenSections((prev) => new Set(prev).add(id));
  };

  const handleSave = () => {
    if (!isSourceSelectionValid) {
      setValidationError("At least one media source must be selected.");
      return;
    }

    onSave({
      sources: draftSources || DEFAULT_MEDIA_SETTINGS.sources,
      saveOnlineMediaToDisk: draftSaveOnlineMediaToDisk !== false,
      mediaType: draftMediaType || DEFAULT_MEDIA_SETTINGS.mediaType,
      textOverlayMode:
        draftTextOverlayMode || DEFAULT_MEDIA_SETTINGS.textOverlayMode,
      captionPosition:
        draftCaptionPosition || DEFAULT_MEDIA_SETTINGS.captionPosition || "bottom",
      captionTheme: draftCaptionTheme || DEFAULT_MEDIA_SETTINGS.captionTheme || "pill",
      enableGraphicMotion: draftTextOverlayMode === "graphics",
      graphicMotionTheme: draftGraphicMotionTheme || "auto",
      zoomSpeed:
        typeof draftZoomSpeed === "number"
          ? draftZoomSpeed
          : DEFAULT_MEDIA_SETTINGS.zoomSpeed,
      transitionDuration:
        typeof draftTransitionDuration === "number"
          ? draftTransitionDuration
          : DEFAULT_MEDIA_SETTINGS.transitionDuration,
      useRelatableVisualSearch: draftRelatableVisualSearch !== false,
      aspectRatio: draftAspectRatio || DEFAULT_MEDIA_SETTINGS.aspectRatio,
      enableEmojiCaptions: draftEnableEmojiCaptions !== false,
      emojiStyle: draftEmojiStyle || "fluent",
      enableDuaOverlay: draftEnableDuaOverlay !== false,
      duaCardTheme: draftDuaCardTheme || "cream",
      enableAvatarHost: draftEnableAvatarHost !== false,
      avatarCategory: draftAvatarCategory || "women_avatars",
      avatarId: draftAvatarId || "Avatar-1",
      saveHistoryEnabled: draftSaveHistoryEnabled !== false,
      historyStorageMode: draftHistoryStorageMode || "server",
    });
    onClose();
  };

  const handleResetDefaults = () => {
    setDraftSources(DEFAULT_MEDIA_SETTINGS.sources);
    setDraftSaveOnlineMediaToDisk(DEFAULT_MEDIA_SETTINGS.saveOnlineMediaToDisk !== false);
    setDraftMediaType(DEFAULT_MEDIA_SETTINGS.mediaType);
    setDraftTextOverlayMode(DEFAULT_MEDIA_SETTINGS.textOverlayMode);
    setDraftCaptionPosition(DEFAULT_MEDIA_SETTINGS.captionPosition || "bottom");
    setDraftCaptionTheme(DEFAULT_MEDIA_SETTINGS.captionTheme || "pill");
    setDraftGraphicMotionTheme(DEFAULT_MEDIA_SETTINGS.graphicMotionTheme || "auto");
    setDraftZoomSpeed(DEFAULT_MEDIA_SETTINGS.zoomSpeed);
    setDraftTransitionDuration(DEFAULT_MEDIA_SETTINGS.transitionDuration);
    setDraftRelatableVisualSearch(
      DEFAULT_MEDIA_SETTINGS.useRelatableVisualSearch !== false,
    );
    setDraftAspectRatio(DEFAULT_MEDIA_SETTINGS.aspectRatio);
    setDraftEnableEmojiCaptions(
      DEFAULT_MEDIA_SETTINGS.enableEmojiCaptions !== false,
    );
    setDraftEmojiStyle(DEFAULT_MEDIA_SETTINGS.emojiStyle || "fluent");
    setDraftEnableDuaOverlay(DEFAULT_MEDIA_SETTINGS.enableDuaOverlay !== false);
    setDraftDuaCardTheme(DEFAULT_MEDIA_SETTINGS.duaCardTheme || "cream");
    setDraftEnableAvatarHost(DEFAULT_MEDIA_SETTINGS.enableAvatarHost !== false);
    setDraftAvatarCategory(DEFAULT_MEDIA_SETTINGS.avatarCategory || "women_avatars");
    setDraftAvatarId(DEFAULT_MEDIA_SETTINGS.avatarId || "Avatar-1");
    setDraftSaveHistoryEnabled(DEFAULT_MEDIA_SETTINGS.saveHistoryEnabled !== false);
    setDraftHistoryStorageMode(DEFAULT_MEDIA_SETTINGS.historyStorageMode || "server");
    setValidationError(null);
    setOpenSections(new Set(DEFAULT_OPEN_SECTIONS));
    setActiveNavId("sources");
  };

  const captionPositionOptions: {
    id: CaptionPosition;
    label: string;
    tagline: string;
    badge: string;
    desc: string;
  }[] = [
    {
      id: "top",
      label: "Top (Upper Third)",
      tagline: "Positioned near header",
      badge: "Header Safe",
      desc: "Keeps the lower screen clean for platform UI buttons and creator handles.",
    },
    {
      id: "middle",
      label: "Middle (Center Screen)",
      tagline: "Dead-center viewport",
      badge: "Kinetic Punch",
      desc: "Maximum visual attention for high-impact spoken words and quotes.",
    },
    {
      id: "bottom",
      label: "Bottom (Lower Third)",
      tagline: "Standard subtitle zone",
      badge: "Default",
      desc: "Classic subtitle position with natural, non-obtrusive reading flow.",
    },
  ];

  const captionThemeOptions: {
    id: CaptionThemeOption;
    label: string;
    tagline: string;
    badge: string;
    desc: string;
    preview: string;
  }[] = [
    {
      id: "pill",
      label: "Dark Pill Badge",
      tagline: "Rounded translucent black badge",
      badge: "Default",
      desc: "Classic subtitle badge — a soft black pill behind bold white text for maximum contrast on any background.",
      preview: "⬛",
    },
    {
      id: "bold_outline",
      label: "Bold Outline",
      tagline: "No background, thick stroked text",
      badge: "Meme Style",
      desc: "Bare Impact-style caption with a heavy black outline and no background badge — punchy and minimal.",
      preview: "🔤",
    },
    {
      id: "gradient_highlight",
      label: "Gradient Highlight",
      tagline: "Brand-colored gradient bar",
      badge: "Vibrant",
      desc: "A rausch-to-gold gradient bar behind the text for a colorful, high-energy look.",
      preview: "🌈",
    },
    {
      id: "pill_translucent",
      label: "Dark Pill (60% Opacity)",
      tagline: "Lighter, more see-through badge",
      badge: "Subtle",
      desc: "Same dark pill badge as the default, but at 60% opacity so more of the footage shows through behind the text.",
      preview: "◻️",
    },
  ];

  const emojiStyleOptions = [
    {
      id: "fluent" as EmojiStyleOption,
      label: "3D Fluent Style",
      tagline: "Glossy 3D emojis (Submagic & CapCut viral style)",
      badge: "Recommended",
      preview: "💔",
    },
    {
      id: "apple" as EmojiStyleOption,
      label: "Apple iOS Style",
      tagline: "High-definition Apple style emoji aesthetics",
      badge: "Classic",
      preview: "✨",
    },
    {
      id: "twitter" as EmojiStyleOption,
      label: "Flat Vector Style",
      tagline: "Clean 2D Twemoji vector illustrations",
      badge: "Minimal",
      preview: "🤲",
    },
  ];

  const duaThemeOptions = [
    {
      id: "cream" as DuaCardThemeOption,
      label: "Cream & Warm Ivory",
      tagline: "Warm ivory parchment with soft gold accents and emerald script",
      badge: "Recommended",
      colorPreview: "#FAF6ED",
      borderPreview: "#E2D3B3",
    },
    {
      id: "white" as DuaCardThemeOption,
      label: "Pure White & Gold",
      tagline: "Pristine white card with crisp high-contrast calligraphy",
      badge: "Minimal Luxe",
      colorPreview: "#FFFFFF",
      borderPreview: "#E5E7EB",
    },
    {
      id: "light_grey" as DuaCardThemeOption,
      label: "Light Grey & Slate",
      tagline: "Subtle slate soft background with deep navy Arabic accents",
      badge: "Modern",
      colorPreview: "#F4F6F8",
      borderPreview: "#CBD5E1",
    },
  ];

  const sourceCards = [
    {
      key: "unsplash" as MediaSourceKey,
      label: "Unsplash",
      tagline: "High-res editorial & authentic photography",
      badge: "API & Web",
      icon: Globe,
    },
    {
      key: "pixabay" as MediaSourceKey,
      label: "Pixabay",
      tagline: "Diverse vector illustrations, photos & footage",
      badge: "Community",
      icon: Sparkles,
    },
    {
      key: "pexels" as MediaSourceKey,
      label: "Pexels",
      tagline: "Cinematic vertical short clips & stock images",
      badge: "Curated",
      icon: Layers,
    },
    {
      key: "local" as MediaSourceKey,
      label: "Local images",
      tagline: "Physical assets in local image-library/ directory",
      badge: "Offline",
      icon: HardDrive,
    },
  ];

  const mediaTypeOptions = [
    {
      id: "only_images" as MediaTypeFilter,
      label: "Only images",
      description: "Photos, stills, and illustrations",
      icon: ImageIcon,
    },
    {
      id: "only_videos" as MediaTypeFilter,
      label: "Only videos",
      description: "Dynamic stock video clips and looping footage",
      icon: Film,
    },
    {
      id: "both" as MediaTypeFilter,
      label: "Both images and stock video footage",
      description: "Intelligently mix static photos and dynamic video clips",
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
      id: "9:16",
      label: "9:16 Vertical (Shorts & Reels)",
      badge: "Default (Shorts & Reels)",
      resolution: "1080 × 1920",
      description:
        "Full-screen portrait format optimized for YouTube Shorts, Instagram Reels, and TikTok feeds.",
      icon: Smartphone,
    },
    {
      id: "16:9",
      label: "16:9 Landscape (Widescreen)",
      badge: "YouTube Desktop",
      resolution: "1920 × 1080",
      description:
        "Standard widescreen horizontal format for traditional YouTube desktop and landscape video players.",
      icon: Monitor,
    },
  ];

  const graphicMotionThemeOptions: {
    id: GraphicMotionThemeOption;
    label: string;
    tagline: string;
    badge: string;
    accentColor: string;
  }[] = [
    {
      id: "auto",
      label: "Auto (AI Mixed)",
      tagline: "AI picks stacked/top-hero/quote styles per beat",
      badge: "Recommended",
      accentColor: "#F57F17",
    },
    {
      id: "breakdown-card",
      label: "Breakdown Card",
      tagline: "Frosted dark card with a gold accent bar",
      badge: "Editorial",
      accentColor: "#F57F17",
    },
    {
      id: "neon-underline",
      label: "Neon Underline",
      tagline: "Glowing cyan hero word with underline accent",
      badge: "Modern",
      accentColor: "#4DE8FF",
    },
    {
      id: "highlight-marker",
      label: "Highlight Marker",
      tagline: "Hand-drawn gold highlighter stroke behind text",
      badge: "Playful",
      accentColor: "#FDD835",
    },
  ];

  const overlayModeOptions: {
    id: TextOverlayMode;
    label: string;
    badge: string;
    icon: React.ElementType;
  }[] = [
    {
      id: "captions",
      label: "Caption",
      badge: "Recommended",
      icon: MessageSquareText,
    },
    {
      id: "graphics",
      label: "Graphic Motion",
      badge: "Kinetic",
      icon: Sparkles,
    },
    {
      id: "none",
      label: "None",
      badge: "Pure Footage",
      icon: Film,
    },
  ];

  // Metadata driving both the accordion headers and the quick-jump nav
  // (mobile chip row + desktop rail).
  const navSections: { id: string; label: string; icon: React.ElementType }[] =
    [
      { id: "sources", label: "Sources", icon: Globe },
      { id: "visualSearch", label: "Visual Search", icon: Sparkles },
      { id: "aspectRatio", label: "Format", icon: Smartphone },
      { id: "mediaType", label: "Media Type", icon: Film },
      { id: "overlayMode", label: "Text", icon: Type },
      { id: "captions", label: "Captions", icon: Smile },
      { id: "dua", label: "Dua", icon: BookOpen },
      { id: "avatar", label: "Avatar", icon: UserCheck },
      { id: "camera", label: "Motion", icon: SlidersHorizontal },
      { id: "history", label: "History", icon: History },
    ];

  const summaries: Record<string, string> = {
    sources: `${selectedSourcesCount} source${
      selectedSourcesCount === 1 ? "" : "s"
    } selected · ${draftSaveOnlineMediaToDisk ? "Saved to disk" : "Streamed"}`,
    visualSearch: draftRelatableVisualSearch ? "Active" : "Disabled",
    aspectRatio:
      aspectRatioOptions.find((o) => o.id === draftAspectRatio)?.label ||
      draftAspectRatio,
    mediaType:
      mediaTypeOptions.find((o) => o.id === draftMediaType)?.label ||
      draftMediaType,
    overlayMode: `${
      overlayModeOptions.find((o) => o.id === draftTextOverlayMode)?.label ||
      draftTextOverlayMode
    }${
      draftTextOverlayMode === "graphics"
        ? ` · ${
            graphicMotionThemeOptions.find(
              (o) => o.id === draftGraphicMotionTheme,
            )?.label || "Auto"
          }`
        : ""
    }`,
    captions: draftEnableEmojiCaptions
      ? `${
          emojiStyleOptions.find((o) => o.id === draftEmojiStyle)?.label
        } · ${
          captionPositionOptions.find((o) => o.id === draftCaptionPosition)
            ?.label
        }`
      : "Emojis disabled",
    dua: draftEnableDuaOverlay
      ? duaThemeOptions.find((o) => o.id === draftDuaCardTheme)?.label ||
        "Enabled"
      : "Disabled",
    avatar: draftEnableAvatarHost
      ? avatarOptions.find((a) => a.id === draftAvatarId)?.id || "Enabled"
      : "Disabled",
    camera: `${draftZoomSpeed.toFixed(1)}x zoom · ${draftTransitionDuration.toFixed(
      1,
    )}s fade`,
    history: draftSaveHistoryEnabled
      ? `Saving · ${draftHistoryStorageMode === "local" ? "Browser storage" : "Server file"}`
      : "Disabled",
  };

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
        className="relative w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl max-h-[90vh] rounded-2xl border border-hairline bg-white shadow-airbnb flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 my-auto"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-hairline-soft flex items-center justify-between gap-4 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#fff0f2] text-rausch shrink-0">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <h2
              id="settings-dialog-title"
              className="text-lg sm:text-xl font-bold text-ink tracking-tight"
            >
              Configuration
            </h2>
          </div>

          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-surface-soft hover:bg-surface-strong border border-hairline text-ink hover:text-ink transition-all flex items-center justify-center shrink-0 active:scale-95 shadow-sm"
            aria-label="Close settings dialog"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Mobile quick-jump chip row */}
        <div className="sm:hidden flex items-center gap-2 px-4 py-2.5 border-b border-hairline-soft overflow-x-auto no-scrollbar shrink-0">
          {navSections.map((nav) => {
            const NavIcon = nav.icon;
            const isActive = activeNavId === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => jumpToSection(nav.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-[#fff0f2] text-rausch border-[#ffd1da]"
                    : "bg-white text-muted border-hairline hover:bg-surface-soft"
                }`}
              >
                <NavIcon className="w-3.5 h-3.5" />
                {nav.label}
              </button>
            );
          })}
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

        {/* Body: desktop rail + scrollable content */}
        <div className="flex-1 flex min-h-[140px] overflow-hidden">
          {/* Desktop left rail */}
          <div className="hidden sm:flex flex-col w-44 shrink-0 border-r border-hairline-soft bg-surface-soft/40 p-2.5 gap-1 overflow-y-auto">
            {navSections.map((nav) => {
              const NavIcon = nav.icon;
              const isActive = activeNavId === nav.id;
              return (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => jumpToSection(nav.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors ${
                    isActive
                      ? "bg-[#fff0f2] text-rausch"
                      : "text-ink hover:bg-surface-soft"
                  }`}
                >
                  <NavIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{nav.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scrollable Form Body */}
          <div ref={bodyRef} className="p-6 space-y-3 overflow-y-auto flex-1">
            {/* Section: Source Selection */}
            <SettingsAccordionSection
              id="sources"
              title="Source Selection"
              icon={Globe}
              summary={summaries.sources}
              isOpen={openSections.has("sources")}
              onToggle={toggleSection}
              sectionRef={(el) => (sectionRefs.current.sources = el)}
            >
              <div className="flex items-center justify-end -mt-1">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                    isSourceSelectionValid
                      ? "bg-surface-soft text-ink border-hairline"
                      : "bg-red-50 text-[#c13515] border-red-200"
                  }`}
                >
                  {selectedSourcesCount} selected
                </span>
              </div>

              <p className="text-xs text-muted">
                Select one or more repositories to source video backgrounds and
                matching imagery.
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
                          ? "bg-[#fff8f9] border-rausch shadow-airbnb"
                          : "bg-white border-hairline hover:border-border-strong hover:bg-surface-soft"
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
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                            isChecked
                              ? "bg-rausch border-rausch text-white"
                              : "border-hairline bg-white"
                          }`}
                        >
                          {isChecked && (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          )}
                        </div>
                      </div>

                      <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                            <IconComponent
                              className={`w-3.5 h-3.5 ${isChecked ? "text-rausch" : "text-muted"}`}
                            />
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

              {/* Storage Option: Save Online Media to Local Disk */}
              <div className="pt-2">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setDraftSaveOnlineMediaToDisk((prev) => !prev)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDraftSaveOnlineMediaToDisk((prev) => !prev);
                    }
                  }}
                  className={`relative flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                    draftSaveOnlineMediaToDisk
                      ? "bg-[#fff8f9] border-rausch shadow-airbnb"
                      : "bg-white border-hairline hover:border-border-strong hover:bg-surface-soft"
                  }`}
                >
                  <div className="pt-0.5 shrink-0">
                    <div
                      className={`w-11 h-6 rounded-full transition-colors flex items-center p-0.5 ${
                        draftSaveOnlineMediaToDisk ? "bg-rausch" : "bg-zinc-300"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                          draftSaveOnlineMediaToDisk ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                        <HardDrive className={`w-4 h-4 ${draftSaveOnlineMediaToDisk ? "text-rausch" : "text-muted"}`} />
                        Save Online Stock Media to Local Library
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          draftSaveOnlineMediaToDisk
                            ? "bg-[#fff0f2] text-rausch border border-[#ffd1da]"
                            : "bg-surface-soft text-muted border border-hairline"
                        }`}
                      >
                        {draftSaveOnlineMediaToDisk ? "Saved to Disk" : "Direct Stream"}
                      </span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      {draftSaveOnlineMediaToDisk
                        ? "Automatically downloads and saves matched Pexels, Pixabay, & Unsplash clips into image-library/ for permanent offline reuse."
                        : "Streams and compiles videos using direct remote URLs without saving permanent files to your local image-library/ folder."}
                    </p>
                  </div>
                </div>
              </div>
            </SettingsAccordionSection>

            {/* Section: Visual Search */}
            <SettingsAccordionSection
              id="visualSearch"
              title="Visual Search"
              icon={Sparkles}
              summary={summaries.visualSearch}
              isOpen={openSections.has("visualSearch")}
              onToggle={toggleSection}
              sectionRef={(el) => (sectionRefs.current.visualSearch = el)}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDraftRelatableVisualSearch((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDraftRelatableVisualSearch((prev) => !prev);
                  }
                }}
                className={`relative flex items-center gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                  draftRelatableVisualSearch
                    ? "bg-[#fff8f9] border-rausch shadow-airbnb"
                    : "bg-white border-hairline hover:border-border-strong hover:bg-surface-soft"
                }`}
              >
                <div className="shrink-0">
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      draftRelatableVisualSearch
                        ? "border-rausch bg-rausch text-white"
                        : "border-hairline bg-white"
                    }`}
                  >
                    {draftRelatableVisualSearch && (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    )}
                  </div>
                </div>

                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink flex items-center gap-2">
                      Visual Search
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                        draftRelatableVisualSearch
                          ? "bg-[#fff0f2] text-rausch border-[#ffd1da]"
                          : "bg-surface-soft text-muted border-hairline-soft"
                      }`}
                    >
                      {draftRelatableVisualSearch
                        ? "Active"
                        : "Disabled"}
                    </span>
                  </div>
                </div>
              </div>
            </SettingsAccordionSection>

            {/* Section: Video Canvas & Aspect Ratio */}
            <SettingsAccordionSection
              id="aspectRatio"
              title="Video Canvas & Aspect Ratio"
              icon={Smartphone}
              summary={summaries.aspectRatio}
              isOpen={openSections.has("aspectRatio")}
              onToggle={toggleSection}
              sectionRef={(el) => (sectionRefs.current.aspectRatio = el)}
            >
              <p className="text-xs text-muted">
                Choose the target format for video and photo assets. YouTube
                Shorts require 9:16 vertical full-screen.
              </p>

              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1"
                role="radiogroup"
                aria-label="Video Aspect Ratio"
              >
                {aspectRatioOptions.map((opt) => {
                  const isSelected = draftAspectRatio === opt.id;
                  const IconComponent = opt.icon;

                  return (
                    <label
                      key={opt.id}
                      htmlFor={`aspect-ratio-${opt.id}`}
                      className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? "bg-[#fff8f9] border-rausch shadow-airbnb"
                          : "bg-white border-hairline hover:border-border-strong hover:bg-surface-soft"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-2 rounded-lg ${isSelected ? "bg-[#fff0f2] text-rausch" : "bg-surface-soft text-muted"}`}
                          >
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

                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                            isSelected
                              ? "border-rausch bg-rausch"
                              : "border-hairline bg-white"
                          }`}
                        >
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
                        <span
                          className={`inline-block text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border mb-1.5 ${
                            isSelected
                              ? "bg-[#fff0f2] text-rausch border-[#ffd1da]"
                              : "bg-surface-soft text-muted border-hairline-soft"
                          }`}
                        >
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
            </SettingsAccordionSection>

            {/* Section: Media Type Filter */}
            <SettingsAccordionSection
              id="mediaType"
              title="Media Type Filter"
              icon={Film}
              summary={summaries.mediaType}
              isOpen={openSections.has("mediaType")}
              onToggle={toggleSection}
              sectionRef={(el) => (sectionRefs.current.mediaType = el)}
            >
              <p className="text-xs text-muted">
                Filter the assets requested by the auto-matcher for each generated
                scene.
              </p>

              <div
                className="flex flex-col gap-2.5 pt-1"
                role="radiogroup"
                aria-label="Media Type Filter"
              >
                {mediaTypeOptions.map((opt) => {
                  const isSelected = draftMediaType === opt.id;
                  const IconComponent = opt.icon;

                  return (
                    <label
                      key={opt.id}
                      htmlFor={`media-type-${opt.id}`}
                      className={`relative flex items-center gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? "bg-[#fff8f9] border-rausch shadow-airbnb"
                          : "bg-white border-hairline hover:border-border-strong hover:bg-surface-soft"
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
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? "border-rausch bg-rausch"
                            : "border-hairline bg-white"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-grow min-w-0">
                        <div
                          className={`p-2 rounded-lg ${isSelected ? "bg-[#fff0f2] text-rausch" : "bg-surface-soft text-muted"}`}
                        >
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
            </SettingsAccordionSection>

            {/* Section: On-Screen Text & Motion Overlays (Mutually Exclusive) */}
            <SettingsAccordionSection
              id="overlayMode"
              title="On-Screen Text & Motion Overlays"
              icon={Type}
              summary={summaries.overlayMode}
              isOpen={openSections.has("overlayMode")}
              onToggle={toggleSection}
              sectionRef={(el) => (sectionRefs.current.overlayMode = el)}
            >
              <div
                className="flex flex-col gap-2.5 pt-1"
                role="radiogroup"
                aria-label="Text Overlay Mode"
              >
                {overlayModeOptions.map((opt) => {
                  const isSelected = draftTextOverlayMode === opt.id;
                  const IconComponent = opt.icon;

                  return (
                    <label
                      key={opt.id}
                      htmlFor={`overlay-mode-${opt.id}`}
                      className={`relative flex items-center gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? "bg-[#fff8f9] border-rausch shadow-airbnb"
                          : "bg-white border-hairline hover:border-border-strong hover:bg-surface-soft"
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
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? "border-rausch bg-rausch"
                            : "border-hairline bg-white"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-grow min-w-0">
                        <div
                          className={`p-2 rounded-lg ${isSelected ? "bg-[#fff0f2] text-rausch" : "bg-surface-soft text-muted"}`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-sm font-bold text-ink block">
                              {opt.label}
                            </span>
                            <span
                              className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                                isSelected
                                  ? "bg-[#fff0f2] text-rausch border-[#ffd1da]"
                                  : "bg-surface-soft text-muted border-hairline-soft"
                              }`}
                            >
                              {opt.badge}
                            </span>
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Graphic Motion Theme Selection (only relevant in Graphic Motion mode) */}
              <div
                className={`pt-3 border-t border-hairline-soft mt-3 transition-opacity ${
                  draftTextOverlayMode === "graphics"
                    ? "opacity-100"
                    : "opacity-40 pointer-events-none"
                }`}
              >
                <span className="text-xs font-bold text-ink block mb-1">
                  Graphic Motion Theme
                </span>
                <p className="text-[11px] text-muted mb-2.5">
                  Choose a fixed visual style for every kinetic-text beat, or
                  let the AI mix styles automatically per beat.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {graphicMotionThemeOptions.map((opt) => {
                    const isSelected = draftGraphicMotionTheme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={draftTextOverlayMode !== "graphics"}
                        onClick={() => setDraftGraphicMotionTheme(opt.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected && draftTextOverlayMode === "graphics"
                            ? "bg-[#fff0f2] border-rausch shadow-sm"
                            : "bg-white border-hairline hover:bg-surface-soft hover:border-border-strong"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span
                            className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: opt.accentColor }}
                          />
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isSelected && draftTextOverlayMode === "graphics"
                                ? "bg-rausch text-white"
                                : "bg-surface-soft text-muted"
                            }`}
                          >
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
            </SettingsAccordionSection>

            {/* Section: Viral Captions & 3D Emojis */}
            <SettingsAccordionSection
              id="captions"
              title="Viral Captions & 3D Emojis"
              icon={Smile}
              summary={summaries.captions}
              isOpen={openSections.has("captions")}
              onToggle={toggleSection}
              sectionRef={(el) => (sectionRefs.current.captions = el)}
            >
              <p className="text-xs text-muted">
                Display high-impact 3D emojis positioned gracefully above subtitle
                captions to maximize viewer retention and emotional resonance.
              </p>

              {/* Toggle Card */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDraftEnableEmojiCaptions((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDraftEnableEmojiCaptions((prev) => !prev);
                  }
                }}
                className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                  draftEnableEmojiCaptions
                    ? "bg-[#fff8f9] border-rausch shadow-airbnb"
                    : "bg-white border-hairline hover:border-border-strong hover:bg-surface-soft"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                    draftEnableEmojiCaptions
                      ? "border-rausch bg-rausch text-white"
                      : "border-hairline bg-white"
                  }`}
                >
                  {draftEnableEmojiCaptions && (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm font-bold text-ink">
                      Enable 3D Emoji Overlays in Captions
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                        draftEnableEmojiCaptions
                          ? "bg-[#fff0f2] text-rausch border-[#ffd1da]"
                          : "bg-surface-soft text-muted border-hairline-soft"
                      }`}
                    >
                      {draftEnableEmojiCaptions ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-tight">
                    Automatically pairs scenes and subtitles with relevant
                    emotional 3D emojis (e.g., 💔, 🤲, ⏳, 🔥, ✨).
                  </p>
                </div>
              </div>

              {/* Emoji Style Selection */}
              <div
                className={`pt-1 transition-opacity ${
                  draftEnableEmojiCaptions
                    ? "opacity-100"
                    : "opacity-40 pointer-events-none"
                }`}
              >
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
                        disabled={!draftEnableEmojiCaptions}
                        onClick={() => setDraftEmojiStyle(opt.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected && draftEnableEmojiCaptions
                            ? "bg-[#fff0f2] border-rausch shadow-sm"
                            : "bg-white border-hairline hover:bg-surface-soft hover:border-border-strong"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-xl">{opt.preview}</span>
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isSelected && draftEnableEmojiCaptions
                                ? "bg-rausch text-white"
                                : "bg-surface-soft text-muted"
                            }`}
                          >
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

              {/* Caption Vertical Position Selection */}
              <div className="pt-3 border-t border-hairline-soft mt-3">
                <span className="text-xs font-bold text-ink block mb-1">
                  Caption Screen Position
                </span>
                <p className="text-[11px] text-muted mb-2.5">
                  Choose where spoken subtitles appear on the video canvas (Top, Middle, or Bottom).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {captionPositionOptions.map((opt) => {
                    const isSelected = draftCaptionPosition === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDraftCaptionPosition(opt.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? "bg-[#fff0f2] border-rausch shadow-sm"
                            : "bg-white border-hairline hover:bg-surface-soft hover:border-border-strong"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-2">
                          {/* Mini Phone Frame Diagram */}
                          <div className="w-6 h-8 rounded border border-hairline bg-surface-soft flex flex-col justify-between p-0.5 shrink-0">
                            <div
                              className={`h-1.5 w-full rounded-[2px] transition-colors ${
                                opt.id === "top"
                                  ? isSelected
                                    ? "bg-rausch"
                                    : "bg-ink"
                                  : "bg-hairline"
                              }`}
                            />
                            <div
                              className={`h-1.5 w-full rounded-[2px] transition-colors ${
                                opt.id === "middle"
                                  ? isSelected
                                    ? "bg-rausch"
                                    : "bg-ink"
                                  : "bg-hairline"
                              }`}
                            />
                            <div
                              className={`h-1.5 w-full rounded-[2px] transition-colors ${
                                opt.id === "bottom"
                                  ? isSelected
                                    ? "bg-rausch"
                                    : "bg-ink"
                                  : "bg-hairline"
                              }`}
                            />
                          </div>

                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isSelected
                                ? "bg-rausch text-white"
                                : "bg-surface-soft text-muted"
                            }`}
                          >
                            {opt.badge}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-ink block leading-tight">
                            {opt.label}
                          </span>
                          <span className="text-[10px] text-muted block mt-0.5 leading-tight">
                            {opt.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Caption Visual Theme Selection */}
              <div className="pt-3 border-t border-hairline-soft mt-3">
                <span className="text-xs font-bold text-ink block mb-1">
                  Caption Visual Theme
                </span>
                <p className="text-[11px] text-muted mb-2.5">
                  Choose how the subtitle text itself is styled — background badge, bare outlined text, or a colored gradient bar.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {captionThemeOptions.map((opt) => {
                    const isSelected = draftCaptionTheme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDraftCaptionTheme(opt.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? "bg-[#fff0f2] border-rausch shadow-sm"
                            : "bg-white border-hairline hover:bg-surface-soft hover:border-border-strong"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="text-xl">{opt.preview}</span>
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isSelected
                                ? "bg-rausch text-white"
                                : "bg-surface-soft text-muted"
                            }`}
                          >
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
                          <span className="text-[10px] text-muted block mt-1 leading-tight">
                            {opt.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </SettingsAccordionSection>

            {/* Section: Spiritual Highlights & Dua Overlays */}
            <SettingsAccordionSection
              id="dua"
              title="Spiritual Highlights & Dua Overlays"
              icon={BookOpen}
              summary={summaries.dua}
              isOpen={openSections.has("dua")}
              onToggle={toggleSection}
              sectionRef={(el) => (sectionRefs.current.dua = el)}
            >
              <p className="text-xs text-muted">
                Detect Quranic & Hadith Duas in the transcript, auto-correct Hindi
                and Arabic text using AI, and render a dedicated Islamic prayer
                card overlay.
              </p>

              {/* Toggle Card */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDraftEnableDuaOverlay((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDraftEnableDuaOverlay((prev) => !prev);
                  }
                }}
                className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                  draftEnableDuaOverlay
                    ? "bg-[#fff8f9] border-rausch shadow-airbnb"
                    : "bg-white border-hairline hover:border-border-strong hover:bg-surface-soft"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                    draftEnableDuaOverlay
                      ? "border-rausch bg-rausch text-white"
                      : "border-hairline bg-white"
                  }`}
                >
                  {draftEnableDuaOverlay && (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm font-bold text-ink">
                      Enable Dua Detection & Card Overlay
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                        draftEnableDuaOverlay
                          ? "bg-[#fff0f2] text-rausch border-[#ffd1da]"
                          : "bg-surface-soft text-muted border-hairline-soft"
                      }`}
                    >
                      {draftEnableDuaOverlay ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-tight">
                    When a Dua is spoken, replaces standard subtitles with a
                    refined prayer card in Hindi and Arabic with Tashkeel.
                  </p>
                </div>
              </div>

              {/* Dua Card Theme Selection */}
              <div
                className={`pt-1 transition-opacity ${
                  draftEnableDuaOverlay
                    ? "opacity-100"
                    : "opacity-40 pointer-events-none"
                }`}
              >
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
                        disabled={!draftEnableDuaOverlay}
                        onClick={() => setDraftDuaCardTheme(opt.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected && draftEnableDuaOverlay
                            ? "bg-[#fff0f2] border-rausch shadow-sm"
                            : "bg-white border-hairline hover:bg-surface-soft hover:border-border-strong"
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
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isSelected && draftEnableDuaOverlay
                                ? "bg-rausch text-white"
                                : "bg-surface-soft text-muted"
                            }`}
                          >
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
            </SettingsAccordionSection>

            {/* Section: AI Avatar Presenter & Split-Screen */}
            <SettingsAccordionSection
              id="avatar"
              title="AI Avatar Presenter & Split-Screen"
              icon={UserCheck}
              summary={summaries.avatar}
              isOpen={openSections.has("avatar")}
              onToggle={toggleSection}
              sectionRef={(el) => (sectionRefs.current.avatar = el)}
            >
              <p className="text-xs text-muted">
                Incorporate a chosen avatar&apos;s gesture clips into the short. Scene 1
                acts as an engaging avatar intro hook, followed by stock footage,
                and Scene 4 renders a dynamic 50/50 split screen.
              </p>

              {/* Toggle Card Container */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  draftEnableAvatarHost
                    ? "bg-[#fff8f9] border-rausch shadow-airbnb"
                    : "bg-white border-hairline"
                }`}
              >
                {/* Interactive Header Row */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setDraftEnableAvatarHost((prev) => !prev)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDraftEnableAvatarHost((prev) => !prev);
                    }
                  }}
                  className="flex items-start gap-3.5 cursor-pointer select-none"
                >
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                      draftEnableAvatarHost
                        ? "border-rausch bg-rausch text-white"
                        : "border-hairline bg-white"
                    }`}
                  >
                    {draftEnableAvatarHost && (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                        Enable Avatar & Split-Screen Storytelling
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                          draftEnableAvatarHost
                            ? "bg-[#fff0f2] text-rausch border-[#ffd1da]"
                            : "bg-surface-soft text-muted border-hairline-soft"
                        }`}
                      >
                        {draftEnableAvatarHost ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs text-muted leading-tight">
                      Automatically chooses gesture explanation videos from the
                      selected avatar below and schedules full-screen and
                      split-screen scenes.
                    </p>
                  </div>
                </div>

                {/* Avatar Picker Grid */}
                <div
                  className={`mt-3 pt-3 border-t border-hairline-soft transition-opacity ${
                    draftEnableAvatarHost ? "opacity-100" : "opacity-40"
                  }`}
                >
                  <span className="text-[11px] font-bold text-ink uppercase tracking-wide">
                    Choose Avatar
                  </span>
                  {avatarOptionsLoading ? (
                    <p className="mt-2 text-xs text-muted">Loading avatars…</p>
                  ) : avatarOptions.length === 0 ? (
                    <p className="mt-2 text-xs text-muted">
                      No avatars found in{" "}
                      <code className="text-[11px] font-mono bg-surface-soft px-1 rounded">
                        image-library/avatars/{draftAvatarCategory}
                      </code>
                      .
                    </p>
                  ) : (
                    <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                      {avatarOptions.map((avatar) => {
                        const isSelected = draftAvatarId === avatar.id;
                        return (
                          <button
                            key={avatar.id}
                            type="button"
                            disabled={!draftEnableAvatarHost}
                            onClick={() => setDraftAvatarId(avatar.id)}
                            className={`group relative rounded-xl border overflow-hidden text-left transition-all ${
                              isSelected
                                ? "border-rausch ring-2 ring-rausch/40 shadow-airbnb"
                                : "border-hairline hover:border-hairline-strong"
                            }`}
                          >
                            <div className="aspect-square w-full bg-surface-soft flex items-center justify-center overflow-hidden">
                              {avatar.thumbnail ? (
                                <img
                                  src={getMediaUrl(avatar.thumbnail)}
                                  alt={avatar.id}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <UserCheck className="w-6 h-6 text-muted" />
                              )}
                            </div>
                            <div className="px-1.5 py-1 bg-white flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold text-ink truncate">
                                {avatar.id}
                              </span>
                              {isSelected && (
                                <Check className="w-3 h-3 text-rausch shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3-Scene Cadence Preview (Safely separated from toggle row) */}
                <div
                  className={`mt-3 pt-3 border-t border-hairline-soft grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] transition-opacity ${
                    draftEnableAvatarHost ? "opacity-100" : "opacity-40"
                  }`}
                >
                  <div className="p-2.5 rounded-lg bg-white border border-hairline flex flex-col gap-1 shadow-xs">
                    <span className="font-bold text-ink flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rausch" />
                      Scene 1: Hook
                    </span>
                    <span className="text-[10px] text-muted leading-tight">
                      Full-screen avatar gesture explaining topic
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-hairline flex flex-col gap-1 shadow-xs">
                    <span className="font-bold text-ink flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Scene 2 & 3: Stock
                    </span>
                    <span className="text-[10px] text-muted leading-tight">
                      Full-screen cinematic footage or photos
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-hairline flex flex-col gap-1 shadow-xs">
                    <span className="font-bold text-ink flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Scene 4: Split-Screen
                    </span>
                    <span className="text-[10px] text-muted leading-tight">
                      Top 50% Avatar clip + Bottom 50% Stock
                    </span>
                  </div>
                </div>
              </div>
            </SettingsAccordionSection>

            {/* Section: Camera & Transition Dynamics */}
            <SettingsAccordionSection
              id="camera"
              title="Camera Dynamics & Transitions"
              icon={SlidersHorizontal}
              summary={summaries.camera}
              isOpen={openSections.has("camera")}
              onToggle={toggleSection}
              sectionRef={(el) => (sectionRefs.current.camera = el)}
            >
              <p className="text-xs text-muted">
                Configure camera zooming motion across clips and crossfade
                transition timing between scenes.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Zoom Speed Card */}
                <div className="p-4 rounded-xl border border-hairline bg-surface-soft/60 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <label
                      htmlFor="settings-zoom-speed"
                      className="text-xs font-bold text-ink uppercase tracking-wider"
                    >
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
                    onChange={(e) =>
                      setDraftZoomSpeed(parseFloat(e.target.value))
                    }
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
                    <label
                      htmlFor="settings-transition-duration"
                      className="text-xs font-bold text-ink uppercase tracking-wider"
                    >
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
                    onChange={(e) =>
                      setDraftTransitionDuration(parseFloat(e.target.value))
                    }
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
            </SettingsAccordionSection>

            {/* Section: Generation History */}
            <SettingsAccordionSection
              id="history"
              title="Generation History"
              icon={History}
              summary={summaries.history}
              isOpen={openSections.has("history")}
              onToggle={toggleSection}
              sectionRef={(el) => (sectionRefs.current.history = el)}
            >
              <p className="text-xs text-muted">
                Keep a running log of your last 10 compiled videos (title,
                channel, and an SEO-ready title/hashtags/description you can
                copy for your own upload).
              </p>

              {/* Toggle: Save Generation History */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDraftSaveHistoryEnabled((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDraftSaveHistoryEnabled((prev) => !prev);
                  }
                }}
                className={`relative flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                  draftSaveHistoryEnabled
                    ? "bg-[#fff8f9] border-rausch shadow-airbnb"
                    : "bg-white border-hairline hover:border-border-strong hover:bg-surface-soft"
                }`}
              >
                <div className="pt-0.5 shrink-0">
                  <div
                    className={`w-11 h-6 rounded-full transition-colors flex items-center p-0.5 ${
                      draftSaveHistoryEnabled ? "bg-rausch" : "bg-zinc-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                        draftSaveHistoryEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>

                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                      <History className={`w-4 h-4 ${draftSaveHistoryEnabled ? "text-rausch" : "text-muted"}`} />
                      Save Generation History
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        draftSaveHistoryEnabled
                          ? "bg-[#fff0f2] text-rausch border border-[#ffd1da]"
                          : "bg-surface-soft text-muted border border-hairline"
                      }`}
                    >
                      {draftSaveHistoryEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    When enabled, every completed video adds an entry (capped
                    at the last 10) with an AI-generated SEO title, hashtags,
                    and description for that video.
                  </p>
                </div>
              </div>

              {/* Storage Mode Picker */}
              {draftSaveHistoryEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {(
                    [
                      {
                        id: "server" as HistoryStorageMode,
                        label: "Server File",
                        icon: Server,
                        desc: "Saved to generated/history.json on this machine. Persists across browsers.",
                      },
                      {
                        id: "local" as HistoryStorageMode,
                        label: "Browser Storage",
                        icon: Laptop,
                        desc: "Kept in this browser's local storage only. Nothing written to disk.",
                      },
                    ] as const
                  ).map((opt) => {
                    const OptIcon = opt.icon;
                    const isActive = draftHistoryStorageMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDraftHistoryStorageMode(opt.id)}
                        className={`text-left p-3.5 rounded-xl border transition-all ${
                          isActive
                            ? "bg-[#fff8f9] border-rausch shadow-airbnb"
                            : "bg-white border-hairline hover:border-border-strong hover:bg-surface-soft"
                        }`}
                      >
                        <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                          <OptIcon className={`w-3.5 h-3.5 ${isActive ? "text-rausch" : "text-muted"}`} />
                          {opt.label}
                        </span>
                        <p className="text-[11px] text-muted mt-1 leading-relaxed">
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </SettingsAccordionSection>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-hairline-soft bg-white flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs font-semibold text-muted hover:text-ink transition-colors underline-offset-4 hover:underline self-center sm:self-auto"
          >
            Reset
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-hairline bg-white text-xs font-bold text-ink hover:bg-surface-soft transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isSourceSelectionValid}
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                !isSourceSelectionValid
                  ? "bg-rausch-disabled text-white cursor-not-allowed"
                  : "bg-rausch hover:bg-rausch-active text-white active:scale-95"
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
