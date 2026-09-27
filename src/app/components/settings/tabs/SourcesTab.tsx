"use client";

import React, { useState } from "react";
import { Check, AlertCircle, HardDrive, Sparkles } from "lucide-react";
import { SOURCE_OPTIONS, MEDIA_TYPE_OPTIONS } from "../settings-options";
import type { MediaSourceKey } from "../settings-types";
import { AdvancedSection, ChoiceCard, ChoiceGroup, Field, ToggleCard } from "../SettingsControls";
import type { ProviderStatus, SettingsTabProps } from "./types";

export default function SourcesTab({
  settings,
  update,
  providerStatus,
}: SettingsTabProps & { providerStatus: ProviderStatus | null }) {
  const [error, setError] = useState<string | null>(null);

  const toggleSource = (key: MediaSourceKey) => {
    const next = { ...settings.sources, [key]: !settings.sources[key] };
    if (!Object.values(next).some(Boolean)) {
      setError("At least one media source must stay selected.");
      return;
    }
    setError(null);
    update({ sources: next });
  };

  return (
    <div className="space-y-5">
      <Field label="Stock libraries" hint="Searched in this order for each scene.">
        {error && (
          <div role="alert" className="p-3 rounded-xl border border-red-200 bg-[#fff5f5] text-[#c13515] flex items-center gap-2 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SOURCE_OPTIONS.map((src) => {
            const checked = settings.sources[src.key];
            const Icon = src.icon;
            const hasKey =
              src.key === "local" || !providerStatus ? null : providerStatus[src.key];
            return (
              <button
                key={src.key}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggleSource(src.key)}
                className={`text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                  checked
                    ? "bg-[#fff8f9] border-rausch shadow-airbnb"
                    : "bg-white border-hairline hover:border-border-strong hover:bg-surface-soft"
                }`}
              >
                <span
                  className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    checked ? "bg-rausch border-rausch text-white" : "border-hairline bg-white"
                  }`}
                >
                  {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </span>
                <span className="flex-grow min-w-0">
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${checked ? "text-rausch" : "text-muted"}`} />
                      {src.label}
                    </span>
                    {hasKey !== null && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          hasKey
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {hasKey ? "Key ✓" : "No API key"}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-muted block mt-0.5 leading-tight">
                    {hasKey === false && checked
                      ? `Skipped — add ${src.envKey} to .env.local`
                      : src.tagline}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="B-roll type">
        <ChoiceGroup label="B-roll type">
          {MEDIA_TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = settings.mediaType === opt.id;
            return (
              <ChoiceCard
                key={opt.id}
                selected={selected}
                onSelect={() => update({ mediaType: opt.id })}
                title={opt.label}
                description={opt.description}
                leading={<Icon className={`w-4 h-4 ${selected ? "text-rausch" : "text-muted"}`} />}
              />
            );
          })}
        </ChoiceGroup>
      </Field>

      <AdvancedSection>
        <ToggleCard
          checked={settings.useRelatableVisualSearch}
          onChange={(v) => update({ useRelatableVisualSearch: v })}
          icon={Sparkles}
          title="Smart B-roll search"
          description="Turns spiritual phrases into concrete, photogenic stock-search queries."
        />
        <ToggleCard
          checked={settings.saveOnlineMediaToDisk}
          onChange={(v) => update({ saveOnlineMediaToDisk: v })}
          icon={HardDrive}
          title="Save B-roll to My Library"
          description={
            settings.saveOnlineMediaToDisk
              ? "Downloads matched clips into image-library/ for offline reuse."
              : "Uses remote URLs directly; nothing saved to disk."
          }
        />
      </AdvancedSection>
    </div>
  );
}
