"use client";

import React from "react";
import { Zap } from "lucide-react";
import { ASPECT_RATIO_OPTIONS } from "../settings-options";
import { AdvancedSection, ChoiceCard, ChoiceGroup, Field, RangeField, ToggleCard } from "../SettingsControls";
import type { SettingsTabProps } from "./types";

export default function VideoTab({ settings, update }: SettingsTabProps) {
  return (
    <div className="space-y-5">
      <Field label="Aspect ratio">
        <ChoiceGroup label="Aspect ratio" cols={2}>
          {ASPECT_RATIO_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = settings.aspectRatio === opt.id;
            return (
              <ChoiceCard
                key={opt.id}
                selected={selected}
                onSelect={() => update({ aspectRatio: opt.id })}
                title={`${opt.id} ${opt.label}`}
                description={`${opt.resolution} · ${opt.description}`}
                leading={<Icon className={`w-4 h-4 ${selected ? "text-rausch" : "text-muted"}`} />}
              />
            );
          })}
        </ChoiceGroup>
      </Field>

      <ToggleCard
        checked={settings.optimizedGeneration}
        onChange={(v) => update({ optimizedGeneration: v })}
        icon={Zap}
        title="Optimized video generation"
        description={
          settings.optimizedGeneration
            ? "Faster render: pre-baked photo backgrounds, low-res blur, cropped overlays."
            : "Original render pipeline."
        }
      />

      <AdvancedSection>
        <RangeField
          id="settings-zoom-speed"
          label="Auto zoom"
          value={settings.zoomSpeed}
          min={0.2}
          max={2}
          step={0.1}
          format={(v) => `${v.toFixed(1)}x`}
          marks={["0.2x Subtle", "1.0x", "2.0x Dramatic"]}
          onChange={(v) => update({ zoomSpeed: v })}
        />
        <RangeField
          id="settings-transition-duration"
          label="Transition"
          value={settings.transitionDuration}
          min={0}
          max={1.5}
          step={0.1}
          format={(v) => `${v.toFixed(1)}s`}
          marks={["0.0s Hard cut", "0.3s", "1.5s Slow"]}
          onChange={(v) => update({ transitionDuration: v })}
        />
      </AdvancedSection>
    </div>
  );
}
