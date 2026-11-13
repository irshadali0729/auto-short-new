import type React from "react";
import {
  Globe,
  Sparkles,
  Layers,
  HardDrive,
  Image as ImageIcon,
  Film,
  SlidersHorizontal,
  Smartphone,
  Monitor,
  MessageSquareText,
  Type,
  BookOpen,
  UserCheck,
  History,
  Flame,
  Mic,
  BellRing,
} from "lucide-react";
import type {
  MediaSettings,
  MediaSourceKey,
  MediaTypeFilter,
  TextOverlayMode,
  CaptionPosition,
  CaptionThemeOption,
  VideoAspectRatio,
  EmojiStyleOption,
  DuaCardThemeOption,
  DuaCardPositionOption,
  GraphicMotionThemeOption,
  CtaPositionOption,
} from "./settings-types";

export type SettingsTabId =
  | "sources"
  | "video"
  | "text"
  | "dua"
  | "host"
  | "cta"
  | "history";

// Each tab owns a fixed set of fields — drives "Reset tab" and the
// "modified" dot on the tab strip.
export const SETTINGS_TABS: {
  id: SettingsTabId;
  label: string;
  icon: React.ElementType;
  fields: (keyof MediaSettings)[];
}[] = [
  {
    id: "sources",
    label: "B-roll",
    icon: Globe,
    fields: ["sources", "mediaType", "saveOnlineMediaToDisk", "useRelatableVisualSearch"],
  },
  {
    id: "video",
    label: "Format",
    icon: Smartphone,
    fields: ["aspectRatio", "zoomSpeed", "transitionDuration", "optimizedGeneration"],
  },
  {
    id: "text",
    label: "Captions",
    icon: Type,
    fields: [
      "textOverlayMode",
      "enableGraphicMotion",
      "graphicMotionTheme",
      "captionPosition",
      "captionTheme",
      "enableEmojiCaptions",
      "emojiStyle",
    ],
  },
  { id: "dua", label: "Dua Card", icon: BookOpen, fields: ["enableDuaOverlay", "duaCardTheme", "duaCardPosition"] },
  { id: "host", label: "AI Avatar", icon: UserCheck, fields: ["enableAvatarHost", "avatarCategory", "avatarId"] },
  {
    id: "cta",
    label: "Subscribe",
    icon: BellRing,
    fields: ["enableCtaOverlays", "ctaVariant", "ctaPosition", "ctaAtEnd", "ctaOnTriggers"],
  },
  { id: "history", label: "History", icon: History, fields: ["saveHistoryEnabled", "historyStorageMode"] },
];

export interface SettingsPreset {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  patch: Partial<MediaSettings>;
}

// Presets only touch look-and-feel fields; sources and history stay as the
// user configured them.
export const SETTINGS_PRESETS: SettingsPreset[] = [
  {
    id: "viral",
    label: "Viral Reel",
    description: "Fast cuts, emoji captions",
    icon: Flame,
    patch: {
      aspectRatio: "9:16",
      mediaType: "both",
      textOverlayMode: "captions",
      captionPosition: "middle",
      captionTheme: "bold_outline",
      enableEmojiCaptions: true,
      emojiStyle: "fluent",
      enableAvatarHost: false,
      zoomSpeed: 1.4,
      transitionDuration: 0.2,
    },
  },
  {
    id: "hadith",
    label: "Hadith Card",
    description: "Calm stills + Dua cards",
    icon: BookOpen,
    patch: {
      aspectRatio: "9:16",
      mediaType: "only_images",
      textOverlayMode: "captions",
      captionPosition: "top",
      captionTheme: "pill",
      enableEmojiCaptions: false,
      enableDuaOverlay: true,
      duaCardTheme: "cream",
      enableAvatarHost: false,
      zoomSpeed: 0.6,
      transitionDuration: 0.6,
    },
  },
  {
    id: "host",
    label: "Host Explainer",
    description: "Presenter + split screen",
    icon: Mic,
    patch: {
      aspectRatio: "9:16",
      mediaType: "both",
      textOverlayMode: "captions",
      captionPosition: "bottom",
      captionTheme: "pill_translucent",
      enableAvatarHost: true,
      zoomSpeed: 1,
      transitionDuration: 0.3,
    },
  },
  {
    id: "wide",
    label: "YouTube Wide",
    description: "16:9 landscape",
    icon: Monitor,
    patch: {
      aspectRatio: "16:9",
      textOverlayMode: "captions",
      captionPosition: "bottom",
      captionTheme: "pill_translucent",
      enableEmojiCaptions: false,
      zoomSpeed: 0.8,
      transitionDuration: 0.5,
    },
  },
];

export const SOURCE_OPTIONS: {
  key: MediaSourceKey;
  label: string;
  tagline: string;
  icon: React.ElementType;
  envKey?: string;
}[] = [
  { key: "unsplash", label: "Unsplash", tagline: "Editorial photography", icon: Globe, envKey: "UNSPLASH_ACCESS_KEY" },
  { key: "pixabay", label: "Pixabay", tagline: "Photos, vectors & footage", icon: Sparkles, envKey: "PIXABAY_API_KEY" },
  { key: "pexels", label: "Pexels", tagline: "Vertical clips & stock images", icon: Layers, envKey: "PEXELS_API_KEY" },
  { key: "local", label: "My Library", tagline: "Files in image-library/", icon: HardDrive },
];

export const MEDIA_TYPE_OPTIONS: {
  id: MediaTypeFilter;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  { id: "only_images", label: "Images", description: "Photos & stills", icon: ImageIcon },
  { id: "only_videos", label: "Videos", description: "Stock clips", icon: Film },
  { id: "both", label: "Mixed", description: "Photos + clips", icon: SlidersHorizontal },
];

export const ASPECT_RATIO_OPTIONS: {
  id: VideoAspectRatio;
  label: string;
  resolution: string;
  description: string;
  icon: React.ElementType;
}[] = [
  { id: "9:16", label: "Vertical", resolution: "1080 × 1920", description: "Shorts, Reels, TikTok", icon: Smartphone },
  { id: "16:9", label: "Landscape", resolution: "1920 × 1080", description: "YouTube desktop", icon: Monitor },
];

export const OVERLAY_MODE_OPTIONS: {
  id: TextOverlayMode;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  { id: "captions", label: "Captions", description: "Word-by-word subtitles", icon: MessageSquareText },
  { id: "graphics", label: "Animated Text", description: "Kinetic keyword beats", icon: Sparkles },
  { id: "none", label: "No Text", description: "Footage only", icon: Film },
];

export const GRAPHIC_THEME_OPTIONS: {
  id: GraphicMotionThemeOption;
  label: string;
  tagline: string;
  accentColor: string;
}[] = [
  { id: "auto", label: "Auto (AI mixed)", tagline: "AI picks a style per beat", accentColor: "#F57F17" },
  { id: "breakdown-card", label: "Breakdown Card", tagline: "Dark card, gold accent bar", accentColor: "#F57F17" },
  { id: "neon-underline", label: "Neon Underline", tagline: "Glowing cyan hero word", accentColor: "#4DE8FF" },
  { id: "highlight-marker", label: "Highlight Marker", tagline: "Gold highlighter stroke", accentColor: "#FDD835" },
];

export const CAPTION_POSITION_OPTIONS: { id: CaptionPosition; label: string; description: string }[] = [
  { id: "top", label: "Top", description: "Clear of platform UI" },
  { id: "middle", label: "Middle", description: "Maximum attention" },
  { id: "bottom", label: "Bottom", description: "Classic subtitles" },
];

export const CAPTION_THEME_OPTIONS: { id: CaptionThemeOption; label: string; description: string }[] = [
  { id: "pill", label: "Dark Pill", description: "Black badge, white text" },
  { id: "pill_translucent", label: "Soft Pill", description: "60% opacity badge" },
  { id: "bold_outline", label: "Bold Outline", description: "No badge, heavy stroke" },
  { id: "gradient_highlight", label: "Gradient Bar", description: "Brand gradient badge" },
];

export const EMOJI_STYLE_OPTIONS: { id: EmojiStyleOption; label: string; preview: string }[] = [
  { id: "fluent", label: "3D Fluent", preview: "💔" },
  { id: "apple", label: "Apple", preview: "✨" },
  { id: "twitter", label: "Flat", preview: "🤲" },
];

export const DUA_POSITION_OPTIONS: { id: DuaCardPositionOption; label: string; description: string }[] = [
  { id: "top", label: "Top", description: "Upper third" },
  { id: "center", label: "Middle", description: "Center screen" },
  { id: "bottom", label: "Bottom", description: "Lower third" },
];

export const CTA_POSITION_OPTIONS: { id: CtaPositionOption; label: string; description: string }[] = [
  { id: "top", label: "Top", description: "Upper area" },
  { id: "middle", label: "Middle", description: "Center screen" },
  { id: "bottom", label: "Bottom", description: "Lower third" },
];

export const DUA_THEME_OPTIONS: {
  id: DuaCardThemeOption;
  label: string;
  description: string;
  background: string;
  border: string;
  accent: string;
  text: string;
  badge: string;
}[] = [
  // Colors mirror utils/dua-card-svg.ts (card bg / border / Arabic / Hindi / header label).
  { id: "cream", label: "Cream Ivory", description: "Warm parchment, emerald script", background: "#FAF6ED", border: "#E2D3B3", accent: "#064E3B", text: "#1E293B", badge: "#6B4A12" },
  { id: "white", label: "Pure White", description: "Crisp high contrast", background: "#FFFFFF", border: "#E5E7EB", accent: "#047857", text: "#111827", badge: "#92400E" },
  { id: "light_grey", label: "Slate Grey", description: "Soft slate, navy script", background: "#F4F6F8", border: "#CBD5E1", accent: "#1E3A8A", text: "#0F172A", badge: "#0F172A" },
  { id: "emerald_dark", label: "Emerald Night", description: "Deep emerald, gold script", background: "#06281E", border: "#D4AF37", accent: "#FCD34D", text: "#F8FAFC", badge: "#FDE68A" },
  { id: "midnight_gold", label: "Midnight Gold", description: "Obsidian black, amber script", background: "#0F1117", border: "#F59E0B", accent: "#FBBF24", text: "#FFFFFF", badge: "#FDE68A" },
];
