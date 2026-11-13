"use client";

import React from "react";
import { BellRing, Clock, MessageSquareText, Shuffle } from "lucide-react";
import { CTA_POSITION_OPTIONS } from "../settings-options";
import { ChoiceCard, ChoiceGroup, Field, PositionGlyph, ToggleCard } from "../SettingsControls";
import CtaAnimation from "@/app/components/CtaAnimation";
import { CTA_VARIANT_AUTO, type CtaLibrary } from "@/app/utils/cta-shared";
import type { SettingsTabProps } from "./types";

function fileLabel(path: string): string {
  return path.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") || path;
}

// Checkerboard so transparent areas of the animation are visible.
const CHECKER_BG: React.CSSProperties = {
  backgroundColor: "#3a3f47",
  backgroundImage:
    "linear-gradient(45deg,#2e3238 25%,transparent 25%),linear-gradient(-45deg,#2e3238 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2e3238 75%),linear-gradient(-45deg,transparent 75%,#2e3238 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0,0 6px,6px -6px,-6px 0",
};

export default function CtaTab({ settings, update, ctaLibrary }: SettingsTabProps & { ctaLibrary: CtaLibrary }) {
  const variants = ctaLibrary.subscribe;
  const selectedExists = variants.some((v) => v.path === settings.ctaVariant);
  const activeVariant = selectedExists ? settings.ctaVariant : CTA_VARIANT_AUTO;

  return (
    <div className="space-y-5">
      <ToggleCard
        checked={settings.enableCtaOverlays}
        onChange={(v) => update({ enableCtaOverlays: v })}
        icon={BellRing}
        title="Subscribe animation"
        description="Adds an animated subscribe button to the video."
      />

      {settings.enableCtaOverlays && (
        <>
          <Field
            label="Animation"
            hint={
              variants.length
                ? "Used at the end of the video and whenever the speaker says subscribe."
                : "No files found. Add transparent .webm or .gif files to image-library/cta/subscribe/."
            }
          >
            <ChoiceGroup label="Subscribe animation" cols={2}>
              <ChoiceCard
                selected={activeVariant === CTA_VARIANT_AUTO}
                onSelect={() => update({ ctaVariant: CTA_VARIANT_AUTO })}
                title="Auto (rotate)"
                description="A different one each time"
                leading={<Shuffle className={`w-4 h-4 ${activeVariant === CTA_VARIANT_AUTO ? "text-rausch" : "text-muted"}`} />}
              />
              {variants.map((v) => (
                <ChoiceCard
                  key={v.path}
                  selected={activeVariant === v.path}
                  onSelect={() => update({ ctaVariant: v.path })}
                  title={fileLabel(v.path)}
                  description={v.duration ? `${v.duration.toFixed(1)}s` : undefined}
                  leading={
                    <span className="w-full h-16 rounded-lg overflow-hidden flex items-center justify-center" style={CHECKER_BG}>
                      <CtaAnimation path={v.path} className="max-w-full max-h-full object-contain" />
                    </span>
                  }
                />
              ))}
            </ChoiceGroup>
          </Field>

          <Field label="Position">
            <ChoiceGroup label="Subscribe animation position">
              {CTA_POSITION_OPTIONS.map((opt) => {
                const selected = settings.ctaPosition === opt.id;
                return (
                  <ChoiceCard
                    key={opt.id}
                    selected={selected}
                    onSelect={() => update({ ctaPosition: opt.id })}
                    title={opt.label}
                    description={opt.description}
                    leading={<PositionGlyph position={opt.id} active={selected} />}
                  />
                );
              })}
            </ChoiceGroup>
          </Field>

          <Field label="When to show">
            <div className="space-y-2.5">
              <ToggleCard
                checked={settings.ctaAtEnd}
                onChange={(v) => update({ ctaAtEnd: v })}
                icon={Clock}
                title="At the end of the video"
                description="Plays in the last seconds so it finishes just before the video ends."
              />
              <ToggleCard
                checked={settings.ctaOnTriggers}
                onChange={(v) => update({ ctaOnTriggers: v })}
                icon={MessageSquareText}
                title="When the speaker says it"
                description="Also plays when a caption says subscribe / सब्सक्राइब (share and bell too, if those files exist)."
              />
            </div>
          </Field>
        </>
      )}
    </div>
  );
}
