"use client";

import React from "react";
import { History, Laptop, Server } from "lucide-react";
import { ChoiceCard, ChoiceGroup, Field, ToggleCard } from "../SettingsControls";
import type { SettingsTabProps } from "./types";

const STORAGE_OPTIONS = [
  { id: "server" as const, label: "Server file", description: "generated/history.json — works across browsers", icon: Server },
  { id: "local" as const, label: "Browser storage", description: "This browser only, nothing on disk", icon: Laptop },
];

export default function HistoryTab({ settings, update }: SettingsTabProps) {
  return (
    <div className="space-y-5">
      <ToggleCard
        checked={settings.saveHistoryEnabled}
        onChange={(v) => update({ saveHistoryEnabled: v })}
        icon={History}
        title="Save generation history"
        description="Keeps your last 10 videos with an AI-generated SEO title, hashtags and description."
      />

      {settings.saveHistoryEnabled && (
        <Field label="Storage">
          <ChoiceGroup label="History storage" cols={2}>
            {STORAGE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = settings.historyStorageMode === opt.id;
              return (
                <ChoiceCard
                  key={opt.id}
                  selected={selected}
                  onSelect={() => update({ historyStorageMode: opt.id })}
                  title={opt.label}
                  description={opt.description}
                  leading={<Icon className={`w-4 h-4 ${selected ? "text-rausch" : "text-muted"}`} />}
                />
              );
            })}
          </ChoiceGroup>
        </Field>
      )}
    </div>
  );
}
