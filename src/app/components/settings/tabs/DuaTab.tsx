"use client";

import React from "react";
import { BookOpen } from "lucide-react";
import { DUA_POSITION_OPTIONS, DUA_THEME_OPTIONS } from "../settings-options";
import { ChoiceCard, ChoiceGroup, Field, PositionGlyph, ToggleCard } from "../SettingsControls";
import type { SettingsTabProps } from "./types";

export default function DuaTab({ settings, update }: SettingsTabProps) {
  return (
    <div className="space-y-5">
      <ToggleCard
        checked={settings.enableDuaOverlay}
        onChange={(v) => update({ enableDuaOverlay: v })}
        icon={BookOpen}
        title="Auto Dua card"
        description="When a Dua is spoken, show a prayer card in Hindi and Arabic (with Tashkeel) instead of captions."
      />

      {settings.enableDuaOverlay && (
        <>
          <Field label="Card theme">
            <ChoiceGroup label="Dua card theme">
              {DUA_THEME_OPTIONS.map((opt) => (
                <ChoiceCard
                  key={opt.id}
                  selected={settings.duaCardTheme === opt.id}
                  onSelect={() => update({ duaCardTheme: opt.id })}
                  title={opt.label}
                  description={opt.description}
                  leading={
                    <span
                      className="w-5 h-5 rounded-md border shadow-inner"
                      style={{ backgroundColor: opt.background, borderColor: opt.border }}
                    />
                  }
                />
              ))}
            </ChoiceGroup>
          </Field>

          <Field label="Position" hint="Default for all Dua scenes; a scene edited in the Dua editor keeps its own.">
            <ChoiceGroup label="Dua card position">
              {DUA_POSITION_OPTIONS.map((opt) => {
                const selected = settings.duaCardPosition === opt.id;
                return (
                  <ChoiceCard
                    key={opt.id}
                    selected={selected}
                    onSelect={() => update({ duaCardPosition: opt.id })}
                    title={opt.label}
                    description={opt.description}
                    leading={<PositionGlyph position={opt.id} active={selected} />}
                  />
                );
              })}
            </ChoiceGroup>
          </Field>
        </>
      )}
    </div>
  );
}
