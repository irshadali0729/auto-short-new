"use client";

import React from "react";
import { Check, UserCheck } from "lucide-react";
import { getMediaUrl } from "@/app/utils/media-url";
import { Field, ToggleCard } from "../SettingsControls";
import type { AvatarPickerOption, SettingsTabProps } from "./types";

export default function HostTab({
  settings,
  update,
  avatarOptions,
  avatarOptionsLoading,
}: SettingsTabProps & {
  avatarOptions: AvatarPickerOption[];
  avatarOptionsLoading: boolean;
}) {
  return (
    <div className="space-y-5">
      <ToggleCard
        checked={settings.enableAvatarHost}
        onChange={(v) => update({ enableAvatarHost: v })}
        icon={UserCheck}
        title="AI avatar & split screen"
        description="Scene 1 is a full-screen avatar hook; every 4th scene is a 50/50 avatar + stock split."
      />

      {settings.enableAvatarHost && (
        <Field label="Choose avatar">
          {avatarOptionsLoading ? (
            <p className="text-xs text-muted">Loading avatars…</p>
          ) : avatarOptions.length === 0 ? (
            <p className="text-xs text-muted">
              No avatars found in{" "}
              <code className="text-[11px] font-mono bg-surface-soft px-1 rounded">
                image-library/avatars/{settings.avatarCategory}
              </code>
              .
            </p>
          ) : (
            <div role="radiogroup" aria-label="Avatar" className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {avatarOptions.map((avatar) => {
                const selected = settings.avatarId === avatar.id;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => update({ avatarId: avatar.id })}
                    className={`relative rounded-xl border overflow-hidden text-left transition-all ${
                      selected
                        ? "border-rausch ring-2 ring-rausch/40 shadow-airbnb"
                        : "border-hairline hover:border-border-strong"
                    }`}
                  >
                    <div className="aspect-square w-full bg-surface-soft flex items-center justify-center overflow-hidden">
                      {avatar.thumbnail ? (
                        <img src={getMediaUrl(avatar.thumbnail)} alt={avatar.id} className="w-full h-full object-cover" />
                      ) : (
                        <UserCheck className="w-6 h-6 text-muted" />
                      )}
                    </div>
                    <div className="px-1.5 py-1 bg-white flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold text-ink truncate">{avatar.id}</span>
                      {selected && <Check className="w-3 h-3 text-rausch shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Field>
      )}
    </div>
  );
}
