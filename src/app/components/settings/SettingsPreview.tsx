"use client";

import React from "react";
import { UserCheck } from "lucide-react";
import { getMediaUrl } from "@/app/utils/media-url";
import { DUA_THEME_OPTIONS, EMOJI_STYLE_OPTIONS } from "./settings-options";
import type { MediaSettings } from "./settings-types";
import type { AvatarPickerOption } from "./tabs/types";
import CtaAnimation from "@/app/components/CtaAnimation";
import { CTA_Y_FRACTION, ctaMaxBox } from "@/app/utils/cta-shared";

const SAMPLE_TEXT = "Allah is with the patient";

const CAPTION_STYLE: Record<string, React.CSSProperties> = {
  pill: { background: "rgba(0,0,0,0.85)", borderRadius: 999, padding: "3px 8px" },
  pill_translucent: { background: "rgba(0,0,0,0.6)", borderRadius: 999, padding: "3px 8px" },
  gradient_highlight: {
    background: "linear-gradient(90deg,#ff385c,#f5b301)",
    borderRadius: 6,
    padding: "3px 8px",
  },
  bold_outline: {
    fontWeight: 900,
    WebkitTextStroke: "0.6px #000",
    textShadow: "0 0 3px #000, 0 0 3px #000",
  },
};

const POSITION_CLASS: Record<string, string> = {
  top: "top-[14%]",
  middle: "top-1/2 -translate-y-1/2",
  bottom: "bottom-[14%]",
};

function Footage({ zoomSpeed }: { zoomSpeed: number }) {
  // Ken Burns approximation: faster zoom → shorter cycle, larger scale.
  const duration = Math.max(2, 8 / Math.max(zoomSpeed, 0.2));
  const scale = 1 + Math.min(zoomSpeed, 2) * 0.06;
  return (
    <div
      className="absolute inset-0"
      style={
        {
          background:
            "radial-gradient(circle at 30% 25%, #f7c873 0%, transparent 45%), linear-gradient(160deg,#3b5875 0%,#1d2f45 55%,#0e1622 100%)",
          animation: `settings-kenburns ${duration}s ease-in-out infinite alternate`,
          "--kb-scale": scale,
        } as React.CSSProperties
      }
    >
      <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute bottom-[18%] left-[10%] w-[45%] h-[18%] bg-[#0b1119] rounded-t-full opacity-80" />
      <div className="absolute bottom-[18%] right-[5%] w-[55%] h-[24%] bg-[#101a26] rounded-t-full opacity-90" />
    </div>
  );
}

function TextOverlay({ settings }: { settings: Required<MediaSettings> }) {
  if (settings.textOverlayMode === "captions") {
    const emoji = EMOJI_STYLE_OPTIONS.find((o) => o.id === settings.emojiStyle)?.preview || "🤲";
    return (
      <div className={`absolute inset-x-0 flex flex-col items-center gap-1 px-2 ${POSITION_CLASS[settings.captionPosition]}`}>
        {settings.enableEmojiCaptions && <span className="text-lg leading-none">{emoji}</span>}
        <span
          className="text-white text-[10px] font-bold text-center leading-tight"
          style={CAPTION_STYLE[settings.captionTheme]}
        >
          {SAMPLE_TEXT}
        </span>
      </div>
    );
  }

  if (settings.textOverlayMode === "graphics") {
    const theme = settings.graphicMotionTheme;
    if (theme === "neon-underline") {
      return (
        <div className="absolute inset-x-0 top-[30%] text-center px-2">
          <span className="text-[9px] text-white/80 block font-semibold">ALLAH IS WITH</span>
          <span
            className="text-sm font-black text-[#4DE8FF] border-b-2 border-[#4DE8FF]"
            style={{ textShadow: "0 0 6px #4DE8FF" }}
          >
            THE PATIENT
          </span>
        </div>
      );
    }
    if (theme === "highlight-marker") {
      return (
        <div className="absolute inset-x-0 top-[30%] text-center px-2">
          <span className="text-[9px] text-white block font-semibold">ALLAH IS WITH</span>
          <span className="text-sm font-black text-ink bg-[#FDD835] px-1.5 -rotate-1 inline-block">
            THE PATIENT
          </span>
        </div>
      );
    }
    return (
      <div className="absolute left-[8%] right-[8%] top-[28%] rounded-md bg-black/60 backdrop-blur-sm border-l-4 border-[#F57F17] px-2 py-1.5">
        <span className="text-[8px] text-white/70 block font-semibold">ALLAH IS WITH</span>
        <span className="text-xs font-black text-white">THE PATIENT</span>
      </div>
    );
  }

  return null;
}

const DUA_POSITION_CLASS: Record<string, string> = {
  top: "top-[10%]",
  center: "top-1/2 -translate-y-1/2",
  bottom: "bottom-[10%]",
};

function DuaCard({ dua, compact }: { dua: (typeof DUA_THEME_OPTIONS)[number]; compact?: boolean }) {
  return (
    <div
      className={`rounded-lg border text-center ${compact ? "px-2 py-1.5" : "px-2.5 py-2"}`}
      style={{ background: dua.background, borderColor: dua.border }}
    >
      <div className="text-[7px] font-bold tracking-wide mb-0.5" style={{ color: dua.badge }}>
        DUA • دعاء
      </div>
      <div className={`${compact ? "text-[11px]" : "text-sm"} font-bold`} style={{ color: dua.accent }} dir="rtl">
        رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً
      </div>
      <div className="text-[8px] mt-0.5" style={{ color: dua.text }}>
        रब्बना आतिना फ़िद्दुनिया हसनह
      </div>
    </div>
  );
}

export default function SettingsPreview({
  settings,
  avatar,
  showDuaScene = false,
  ctaPath,
}: {
  settings: Required<MediaSettings>;
  avatar: AvatarPickerOption | undefined;
  // Render the frame as a Dua scene (card at its position) instead of captions.
  showDuaScene?: boolean;
  // Subscribe animation to show in the frame (Subscribe tab).
  ctaPath?: string;
}) {
  const ctaBox = ctaMaxBox(settings.aspectRatio);
  const isVertical = settings.aspectRatio === "9:16";
  const dua = DUA_THEME_OPTIONS.find((o) => o.id === settings.duaCardTheme) || DUA_THEME_OPTIONS[0];
  const duaInFrame = showDuaScene && settings.enableDuaOverlay;
  const showHost = settings.enableAvatarHost && !duaInFrame;

  const hostPane = (
    <div className="relative bg-[#2a2f36] flex items-center justify-center overflow-hidden">
      {avatar?.thumbnail ? (
        <img src={getMediaUrl(avatar.thumbnail)} alt="" className="w-full h-full object-cover" />
      ) : (
        <UserCheck className="w-6 h-6 text-white/50" />
      )}
    </div>
  );

  return (
    <div className="space-y-3" aria-label="Live settings preview">
      <style>{`@keyframes settings-kenburns { from { transform: scale(1); } to { transform: scale(var(--kb-scale)); } }`}</style>

      <div className="text-[10px] font-bold text-muted uppercase tracking-wide">Live preview</div>

      <div
        className={`relative mx-auto rounded-xl overflow-hidden bg-black shadow-airbnb border border-hairline ${
          isVertical ? "w-[168px] aspect-[9/16]" : "w-full aspect-video"
        }`}
      >
        {showHost ? (
          <div className={`absolute inset-0 grid ${isVertical ? "grid-rows-2" : "grid-cols-2"}`}>
            {hostPane}
            <div className="relative overflow-hidden">
              <Footage zoomSpeed={settings.zoomSpeed} />
            </div>
          </div>
        ) : (
          <Footage zoomSpeed={settings.zoomSpeed} />
        )}
        {duaInFrame ? (
          <>
            <div className="absolute inset-0 bg-black/45" />
            <div className={`absolute inset-x-[6%] ${DUA_POSITION_CLASS[settings.duaCardPosition]}`}>
              <DuaCard dua={dua} compact />
            </div>
          </>
        ) : (
          <TextOverlay settings={settings} />
        )}
        {ctaPath && (
          <div
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
            style={{
              top: `${CTA_Y_FRACTION[settings.ctaPosition] * 100}%`,
              width: `${ctaBox.w * 100}%`,
              height: `${ctaBox.h * 100}%`,
            }}
          >
            <CtaAnimation path={ctaPath} className="max-w-full max-h-full object-contain" />
          </div>
        )}
        {(showHost || duaInFrame) && (
          <span className="absolute top-1.5 left-1.5 text-[8px] font-bold uppercase bg-black/60 text-white px-1.5 py-0.5 rounded">
            {duaInFrame ? "Dua scene" : "Split scene"}
          </span>
        )}
      </div>

      {settings.enableDuaOverlay && !duaInFrame && (
        <div>
          <div className="text-[10px] font-bold text-muted uppercase tracking-wide mb-1">Dua scene</div>
          <DuaCard dua={dua} />
        </div>
      )}

      <dl className="text-[11px] text-muted grid grid-cols-2 gap-x-2 gap-y-0.5">
        <dt>Format</dt>
        <dd className="text-ink font-semibold text-right">{isVertical ? "1080×1920" : "1920×1080"}</dd>
        <dt>Zoom</dt>
        <dd className="text-ink font-semibold text-right">{settings.zoomSpeed.toFixed(1)}x</dd>
        <dt>Fade</dt>
        <dd className="text-ink font-semibold text-right">{settings.transitionDuration.toFixed(1)}s</dd>
      </dl>
    </div>
  );
}
