// Client-safe CTA (subscribe/share/bell animation) logic, shared by the
// FFmpeg render (api/generate-video) and the in-browser storyboard preview so
// both place the same animation at the same time. File-system access lives
// in cta-library.ts.

import type { CaptionSlice } from "@/app/types/scene";

export type CtaType = "subscribe" | "share" | "bell";
export type CtaPosition = "top" | "middle" | "bottom";

/** One animation file; `path` is relative to image-library/ (e.g. "cta/subscribe/subscribe_1.webm"). */
export interface CtaVariant {
  path: string;
  /** Seconds; 0 when unknown. */
  duration: number;
}

export type CtaLibrary = Record<CtaType, CtaVariant[]>;

export const EMPTY_CTA_LIBRARY: CtaLibrary = { subscribe: [], share: [], bell: [] };

export const CTA_TYPES: CtaType[] = ["subscribe", "share", "bell"];

/** `ctaVariant` value meaning "rotate through every subscribe file". */
export const CTA_VARIANT_AUTO = "auto";

// Trigger words in English, Hindi (Devanagari) and Urdu script.
const CTA_TRIGGERS: Record<CtaType, RegExp> = {
  subscribe: /subscri|सब्सक्राइब|सबस्क्राइब|सब्स्क्राइब|سبسکرائب|سبسکرائیب|سبسکراب/i,
  share: /\bshare|शेयर|शेअर|شیئر|شئیر|شیر کریں/i,
  bell: /\bbell\b|घंटी|बेल आइकन|बेल बटन|گھنٹی|بیل آئیکن/i,
};

// The end-of-video CTA finishes this long before the video ends.
const END_TAIL_SEC = 0.3;
// Used when a file's length is unknown.
const FALLBACK_CLIP_SEC = 3;

// Vertical centre of the animation as a fraction of frame height.
export const CTA_Y_FRACTION: Record<CtaPosition, number> = {
  top: 0.16,
  middle: 0.5,
  bottom: 0.8,
};

// Max animation box as a fraction of the frame (it scales to fit, keeping aspect).
export function ctaMaxBox(aspectRatio: "9:16" | "16:9"): { w: number; h: number } {
  return aspectRatio === "16:9" ? { w: 0.45, h: 0.3 } : { w: 0.75, h: 0.18 };
}

export interface CtaOptions {
  /** CTA_VARIANT_AUTO or a subscribe file path. */
  variant: string;
  atEnd: boolean;
  onTriggers: boolean;
}

export interface CtaPlacement {
  type: CtaType;
  path: string;
  /** Scene-relative time the animation appears, in seconds. */
  start: number;
  /** Seconds into the animation file to begin from (> 0 when it continues from the previous scene). */
  offset: number;
}

interface CtaEvent {
  type: CtaType;
  path: string;
  /** Video-global start/end in seconds. */
  start: number;
  end: number;
}

/**
 * One entry per scene (null = no CTA). Trigger words in captions start a CTA
 * at that line; with `atEnd` a subscribe CTA is timed to finish just before
 * the video ends. A CTA longer than its scene carries on into the following
 * scenes (via `offset`), so short scenes don't cut it off. Where two overlap,
 * the later one wins that scene — so the end CTA always plays in full.
 */
export function planCtaPlacements(
  scenes: { captions?: CaptionSlice[]; duration: number }[],
  library: CtaLibrary,
  options: CtaOptions,
): (CtaPlacement | null)[] {
  const rotation: Record<CtaType, number> = { subscribe: 0, share: 0, bell: 0 };
  const fixedSubscribe =
    options.variant !== CTA_VARIANT_AUTO
      ? library.subscribe.find((v) => v.path === options.variant)
      : undefined;

  const pick = (type: CtaType): CtaVariant | undefined => {
    if (type === "subscribe" && fixedSubscribe) return fixedSubscribe;
    const list = library[type];
    return list.length ? list[rotation[type]++ % list.length] : undefined;
  };
  const clipLength = (v: CtaVariant) => (v.duration > 0 ? v.duration : FALLBACK_CLIP_SEC);

  const sceneStarts: number[] = [];
  let total = 0;
  for (const scene of scenes) {
    sceneStarts.push(total);
    total += Number(scene.duration) || 0;
  }

  // 1. Collect events on the global timeline, in order.
  const events: CtaEvent[] = [];
  if (options.onTriggers) {
    scenes.forEach((scene, i) => {
      for (const cap of scene.captions || []) {
        const text = String(cap.text || "");
        const type = CTA_TYPES.find((t) => library[t].length > 0 && CTA_TRIGGERS[t].test(text));
        if (!type) continue;
        const variant = pick(type)!;
        const start = sceneStarts[i] + Math.max(0, Number(cap.start) || 0);
        events.push({ type, path: variant.path, start, end: start + clipLength(variant) });
        return; // at most one trigger per scene
      }
    });
  }
  if (options.atEnd && scenes.length > 0 && library.subscribe.length > 0) {
    const variant = pick("subscribe")!;
    const length = clipLength(variant);
    const start = Math.max(0, total - length - END_TAIL_SEC);
    events.push({ type: "subscribe", path: variant.path, start, end: start + length });
  }

  // 2. Project each event onto every scene it overlaps; later events win.
  const plan: (CtaPlacement | null)[] = scenes.map(() => null);
  for (const ev of events) {
    scenes.forEach((scene, i) => {
      const sceneStart = sceneStarts[i];
      const sceneEnd = sceneStart + (Number(scene.duration) || 0);
      if (ev.end <= sceneStart || ev.start >= sceneEnd) return;
      const visibleFrom = Math.max(ev.start, sceneStart);
      plan[i] = {
        type: ev.type,
        path: ev.path,
        start: Number((visibleFrom - sceneStart).toFixed(2)),
        offset: Number((visibleFrom - ev.start).toFixed(2)),
      };
    });
  }

  return plan;
}
