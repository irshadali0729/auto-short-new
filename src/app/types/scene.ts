/**
 * Canonical scene-related types shared across the pipeline (analyze-transcript,
 * match-images, generate-video routes, the renderer utils, and page.tsx).
 * These types travel across API boundaries, so keep every consumer importing
 * from here instead of redefining its own local copy.
 */

export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
  end: number;
}

export type GraphicBeatStyle =
  | "stacked-kinetic"
  | "top-hero"
  | "thought-bubble"
  | "breakdown-card"
  | "neon-underline"
  | "highlight-marker";

// "auto" lets each beat keep whichever style the AI assigned it (a mix of
// stacked-kinetic/top-hero/thought-bubble); any other value forces every
// beat in the video to render with that one theme.
export type GraphicMotionThemeOption = "auto" | GraphicBeatStyle;

export type GraphicBeatType = "impact" | "money" | "result" | "platform";

export interface GraphicBeat {
  prefixText?: string;
  heroWord: string;
  suffixText?: string;
  style?: GraphicBeatStyle;
  text?: string;
  accent?: string;
  type?: GraphicBeatType;
  start: number;
  end: number;
}

export interface CaptionSlice {
  text: string;
  start: number;
  end: number;
  emoji?: string;
}

export type DuaCardTheme =
  | "cream"
  | "white"
  | "light_grey"
  | "emerald_dark"
  | "midnight_gold";

export type DuaCardPosition = "top" | "center" | "bottom";
export type DuaCardStyle = "classic" | "minimal_glass" | "floating_pill" | "full_banner";

export interface DuaInfo {
  isDua: boolean;
  hindi: string;
  arabic: string;
  title?: string;
  reference?: string;
  theme?: DuaCardTheme;
  position?: DuaCardPosition;
  cardStyle?: DuaCardStyle;
}

export type MatchedTier = "visual" | "fallback" | "mood" | "local" | "random" | "legacy";

/** A scene after image/video matching has resolved its media asset. */
export interface Scene {
  keyword: string;
  duration: number;
  image: string;
  isFallback: boolean;
  isAvatarScene?: boolean;
  isSplitScreen?: boolean;
  avatarAsset?: string;
  stockAsset?: string;
  visualQuery?: string;
  fallbackQuery?: string;
  moodQuery?: string;
  matchedTier?: MatchedTier;
  matchedQuery?: string;
  emoji?: string;
  graphics?: GraphicBeat[];
  captions?: CaptionSlice[];
  duaInfo?: DuaInfo;
}
