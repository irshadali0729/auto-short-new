import type {
  DuaCardPosition,
  DuaCardTheme,
  GraphicMotionThemeOption,
} from "@/app/types/scene";

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
export type DuaCardThemeOption = DuaCardTheme;
export type DuaCardPositionOption = DuaCardPosition;
export type HistoryStorageMode = "server" | "local";

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
  // Faster render path (pre-baked stills, low-res blur, cropped overlays).
  optimizedGeneration?: boolean;
  useRelatableVisualSearch?: boolean;
  aspectRatio: VideoAspectRatio;
  enableEmojiCaptions?: boolean;
  emojiStyle?: EmojiStyleOption;
  enableDuaOverlay?: boolean;
  duaCardTheme?: DuaCardThemeOption;
  // Default card position; a per-scene position set in the Dua editor wins.
  duaCardPosition?: DuaCardPositionOption;
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
  optimizedGeneration: false,
  useRelatableVisualSearch: true,
  aspectRatio: "9:16",
  enableEmojiCaptions: false,
  emojiStyle: "fluent",
  enableDuaOverlay: false,
  duaCardTheme: "cream",
  duaCardPosition: "center",
  enableAvatarHost: false,
  avatarCategory: "women_avatars",
  avatarId: "Avatar-1",
  saveHistoryEnabled: true,
  historyStorageMode: "server",
};

function resolveOverlayMode(s: Partial<MediaSettings>): TextOverlayMode {
  if (s.textOverlayMode) return s.textOverlayMode;
  if (s.enableGraphicMotion) return "graphics";
  return "captions";
}

// Fills every optional field so the settings UI never has to fall back to
// defaults inline. Older saved settings may predate newer fields.
export function normalizeSettings(
  s: Partial<MediaSettings> | undefined,
): Required<MediaSettings> {
  const merged = { ...DEFAULT_MEDIA_SETTINGS, ...(s || {}) };
  const textOverlayMode = resolveOverlayMode(merged);
  return {
    ...(merged as Required<MediaSettings>),
    sources: { ...DEFAULT_MEDIA_SETTINGS.sources, ...(s?.sources || {}) },
    textOverlayMode,
    enableGraphicMotion: textOverlayMode === "graphics",
  };
}

// Tab/preset/reset helpers compare field values structurally (sources is an object).
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
