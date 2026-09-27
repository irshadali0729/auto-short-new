"use client";

import React from "react";
import { Smile } from "lucide-react";
import {
  OVERLAY_MODE_OPTIONS,
  GRAPHIC_THEME_OPTIONS,
  CAPTION_POSITION_OPTIONS,
  CAPTION_THEME_OPTIONS,
  EMOJI_STYLE_OPTIONS,
} from "../settings-options";
import {
  ChoiceCard,
  ChoiceGroup,
  Field,
  Notice,
  PositionGlyph,
  ToggleCard,
} from "../SettingsControls";
import type { SettingsTabProps } from "./types";

export default function TextTab({ settings, update }: SettingsTabProps) {
  const mode = settings.textOverlayMode;

  return (
    <div className="space-y-5">
      <Field label="Text type" hint="Dua cards replace this on Dua scenes.">
        <ChoiceGroup label="Text type">
          {OVERLAY_MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = mode === opt.id;
            return (
              <ChoiceCard
                key={opt.id}
                selected={selected}
                onSelect={() => update({ textOverlayMode: opt.id })}
                title={opt.label}
                description={opt.description}
                leading={<Icon className={`w-4 h-4 ${selected ? "text-rausch" : "text-muted"}`} />}
              />
            );
          })}
        </ChoiceGroup>
      </Field>

      {mode === "none" && (
        <Notice>No text will be drawn over footage. Pick Captions or Animated Text for more options.</Notice>
      )}

      {mode === "graphics" && (
        <Field label="Animation style">
          <ChoiceGroup label="Animation style" cols={2}>
            {GRAPHIC_THEME_OPTIONS.map((opt) => (
              <ChoiceCard
                key={opt.id}
                selected={settings.graphicMotionTheme === opt.id}
                onSelect={() => update({ graphicMotionTheme: opt.id })}
                title={opt.label}
                description={opt.tagline}
                leading={
                  <span
                    className="w-4 h-4 rounded-full border border-black/10"
                    style={{ backgroundColor: opt.accentColor }}
                  />
                }
              />
            ))}
          </ChoiceGroup>
        </Field>
      )}

      {mode === "captions" && (
        <>
          <Field label="Position">
            <ChoiceGroup label="Caption position">
              {CAPTION_POSITION_OPTIONS.map((opt) => {
                const selected = settings.captionPosition === opt.id;
                return (
                  <ChoiceCard
                    key={opt.id}
                    selected={selected}
                    onSelect={() => update({ captionPosition: opt.id })}
                    title={opt.label}
                    description={opt.description}
                    leading={<PositionGlyph position={opt.id} active={selected} />}
                  />
                );
              })}
            </ChoiceGroup>
          </Field>

          <Field label="Caption style">
            <ChoiceGroup label="Caption style" cols={2}>
              {CAPTION_THEME_OPTIONS.map((opt) => (
                <ChoiceCard
                  key={opt.id}
                  selected={settings.captionTheme === opt.id}
                  onSelect={() => update({ captionTheme: opt.id })}
                  title={opt.label}
                  description={opt.description}
                />
              ))}
            </ChoiceGroup>
          </Field>

          <Field label="Emojis">
            <ToggleCard
              checked={settings.enableEmojiCaptions}
              onChange={(v) => update({ enableEmojiCaptions: v })}
              icon={Smile}
              title="Auto emojis"
              description="Pairs each caption with a relevant emoji (💔 🤲 ⏳ 🔥)."
            />
            {settings.enableEmojiCaptions && (
              <ChoiceGroup label="Emoji style">
                {EMOJI_STYLE_OPTIONS.map((opt) => (
                  <ChoiceCard
                    key={opt.id}
                    selected={settings.emojiStyle === opt.id}
                    onSelect={() => update({ emojiStyle: opt.id })}
                    title={opt.label}
                    leading={<span className="text-lg leading-none">{opt.preview}</span>}
                  />
                ))}
              </ChoiceGroup>
            )}
          </Field>
        </>
      )}
    </div>
  );
}
