"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Settings as SettingsIcon, RotateCcw, Check, Eye } from "lucide-react";
import { useFocusTrap } from "@/app/utils/useFocusTrap";
import {
  DEFAULT_MEDIA_SETTINGS,
  normalizeSettings,
  sameValue,
  type MediaSettings,
} from "@/app/components/settings/settings-types";
import {
  SETTINGS_PRESETS,
  SETTINGS_TABS,
  type SettingsTabId,
} from "@/app/components/settings/settings-options";
import { TabHeader } from "@/app/components/settings/SettingsControls";
import SettingsPreview from "@/app/components/settings/SettingsPreview";
import SourcesTab from "@/app/components/settings/tabs/SourcesTab";
import VideoTab from "@/app/components/settings/tabs/VideoTab";
import TextTab from "@/app/components/settings/tabs/TextTab";
import DuaTab from "@/app/components/settings/tabs/DuaTab";
import HostTab from "@/app/components/settings/tabs/HostTab";
import HistoryTab from "@/app/components/settings/tabs/HistoryTab";
import type {
  AvatarPickerOption,
  ProviderStatus,
} from "@/app/components/settings/tabs/types";

// Types and defaults live in settings/settings-types.ts; re-exported here so
// existing imports from "@/app/components/SettingsModal" keep working.
// (Explicit list: Next.js rejects `export *` in a "use client" module.)
export { DEFAULT_MEDIA_SETTINGS } from "@/app/components/settings/settings-types";
export type {
  MediaSettings,
  MediaSourceKey,
  MediaTypeFilter,
  TextOverlayMode,
  CaptionPosition,
  CaptionThemeOption,
  VideoAspectRatio,
  EmojiStyleOption,
  DuaCardThemeOption,
  DuaCardPositionOption,
  HistoryStorageMode,
  GraphicMotionThemeOption,
} from "@/app/components/settings/settings-types";

const TAB_COPY: Record<SettingsTabId, { title: string; description: string }> = {
  sources: { title: "B-roll", description: "Where scene footage comes from." },
  video: { title: "Format & motion", description: "Aspect ratio, auto zoom and transitions." },
  text: { title: "Captions", description: "What's drawn over the footage." },
  dua: { title: "Dua card", description: "Prayer card shown when a Dua is spoken." },
  host: { title: "AI avatar", description: "Avatar hook and split-screen scenes." },
  history: { title: "History", description: "Log of recently generated videos." },
};

const UNDO_TIMEOUT_MS = 5000;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: MediaSettings;
  onSave: (newSettings: MediaSettings) => void;
}

// Side drawer (not a centered modal) so the storyboard stays visible while
// tweaking. Every change is applied and persisted immediately; an undo toast
// replaces the old Save/Cancel buttons.
export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: SettingsModalProps) {
  const current = useMemo(() => normalizeSettings(settings), [settings]);
  // Rapid updates (slider drags) can fire before the parent re-renders with
  // new props, so always build the next state from the latest applied one.
  const latestRef = useRef(current);
  latestRef.current = current;

  const [activeTab, setActiveTab] = useState<SettingsTabId>("sources");
  // Below md the preview column is hidden; this sheet shows it on demand.
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; snapshot: MediaSettings } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [avatarOptions, setAvatarOptions] = useState<AvatarPickerOption[]>([]);
  const [avatarOptionsLoading, setAvatarOptionsLoading] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useFocusTrap(isOpen, dialogRef, closeBtnRef);

  const update = useCallback(
    (patch: Partial<MediaSettings>, message = "Settings saved") => {
      const before = latestRef.current;
      const next = normalizeSettings({ ...before, ...patch });
      latestRef.current = next;
      onSave(next);
      // Consecutive edits within the undo window collapse into one undo step
      // that restores the state from before the first edit.
      setToast((prev) => ({ message, snapshot: prev ? prev.snapshot : before }));
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), UNDO_TIMEOUT_MS);
    },
    [onSave],
  );

  const handleUndo = () => {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    onSave(toast.snapshot);
    setToast(null);
  };

  useEffect(() => {
    if (!isOpen) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast(null);
      setMobilePreviewOpen(false);
    }
  }, [isOpen]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // Provider key status never changes at runtime; fetch once.
  useEffect(() => {
    if (!isOpen || providerStatus) return;
    fetch("/api/provider-status")
      .then((res) => res.json())
      .then((data: ProviderStatus) => setProviderStatus(data))
      .catch(() => {});
  }, [isOpen, providerStatus]);

  // Avatar thumbnails feed both the Host tab picker and the live preview.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setAvatarOptionsLoading(true);
    fetch(`/api/list-avatars?category=${encodeURIComponent(current.avatarCategory)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAvatarOptions(data.avatars || []);
      })
      .catch(() => {
        if (!cancelled) setAvatarOptions([]);
      })
      .finally(() => {
        if (!cancelled) setAvatarOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, current.avatarCategory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !isOpen) return;
      if (mobilePreviewOpen) setMobilePreviewOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, mobilePreviewOpen]);

  if (!isOpen) return null;

  const isTabDefault = (id: SettingsTabId) =>
    SETTINGS_TABS.find((t) => t.id === id)!.fields.every((f) =>
      sameValue(current[f], DEFAULT_MEDIA_SETTINGS[f]),
    );

  const resetTab = (id: SettingsTabId) => {
    const fields = SETTINGS_TABS.find((t) => t.id === id)!.fields;
    const patch: Partial<MediaSettings> = {};
    for (const f of fields) {
      (patch as Record<string, unknown>)[f] = DEFAULT_MEDIA_SETTINGS[f];
    }
    update(patch, `${TAB_COPY[id].title} reset`);
  };

  const isPresetActive = (patch: Partial<MediaSettings>) =>
    (Object.keys(patch) as (keyof MediaSettings)[]).every((k) =>
      sameValue(current[k], patch[k]),
    );

  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next = SETTINGS_TABS[(index + delta + SETTINGS_TABS.length) % SETTINGS_TABS.length];
    setActiveTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const tabProps = { settings: current, update };
  const selectedAvatar = avatarOptions.find((a) => a.id === current.avatarId);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <style>{`@keyframes settings-drawer-in { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>

      {/* Light scrim keeps the storyboard visible behind the drawer. */}
      <div className="fixed inset-0 bg-black/20" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        className="relative h-full w-full sm:max-w-[780px] bg-white border-l border-hairline shadow-airbnb flex flex-col"
        style={{ animation: "settings-drawer-in 180ms ease-out" }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-hairline-soft flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#fff0f2] text-rausch shrink-0">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 id="settings-dialog-title" className="text-lg font-bold text-ink tracking-tight">
                Configuration
              </h2>
              <p className="text-[11px] text-muted">Changes save automatically</p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-soft hover:bg-surface-strong border border-hairline text-ink flex items-center justify-center shrink-0 active:scale-95"
            aria-label="Close settings"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Presets */}
        <div className="px-5 py-3 border-b border-hairline-soft shrink-0">
          <div className="text-[10px] font-bold text-muted uppercase tracking-wide mb-2">Templates</div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {SETTINGS_PRESETS.map((preset) => {
              const Icon = preset.icon;
              const active = isPresetActive(preset.patch);
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update(preset.patch, `Applied “${preset.label}”`)}
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                    active
                      ? "bg-[#fff8f9] border-rausch shadow-airbnb"
                      : "bg-white border-hairline hover:border-border-strong hover:bg-surface-soft"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? "text-rausch" : "text-muted"}`} />
                  <span>
                    <span className="text-xs font-bold text-ink block leading-tight">{preset.label}</span>
                    <span className="text-[10px] text-muted block leading-tight">{preset.description}</span>
                  </span>
                  {active && <Check className="w-3.5 h-3.5 text-rausch" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Settings sections"
          className="px-5 border-b border-hairline-soft flex gap-1 overflow-x-auto no-scrollbar shrink-0"
        >
          {SETTINGS_TABS.map((tab, i) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            const modified = !isTabDefault(tab.id);
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                type="button"
                role="tab"
                id={`settings-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`settings-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                className={`relative shrink-0 flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                  selected
                    ? "border-rausch text-rausch"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {modified && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rausch" aria-label="(modified)" />
                )}
              </button>
            );
          })}
        </div>

        {/* Body: tab panel + live preview */}
        <div className="flex-1 flex min-h-0">
          <div
            role="tabpanel"
            id={`settings-panel-${activeTab}`}
            aria-labelledby={`settings-tab-${activeTab}`}
            className="flex-1 overflow-y-auto p-5 space-y-5"
          >
            <TabHeader
              title={TAB_COPY[activeTab].title}
              description={TAB_COPY[activeTab].description}
              canReset={!isTabDefault(activeTab)}
              onReset={() => resetTab(activeTab)}
            />
            {activeTab === "sources" && <SourcesTab {...tabProps} providerStatus={providerStatus} />}
            {activeTab === "video" && <VideoTab {...tabProps} />}
            {activeTab === "text" && <TextTab {...tabProps} />}
            {activeTab === "dua" && <DuaTab {...tabProps} />}
            {activeTab === "host" && (
              <HostTab
                {...tabProps}
                avatarOptions={avatarOptions}
                avatarOptionsLoading={avatarOptionsLoading}
              />
            )}
            {activeTab === "history" && <HistoryTab {...tabProps} />}
          </div>

          <aside className="hidden md:block w-[220px] shrink-0 border-l border-hairline-soft bg-surface-soft/40 p-4 overflow-y-auto">
            <SettingsPreview
              settings={current}
              avatar={selectedAvatar}
              showDuaScene={activeTab === "dua"}
            />
          </aside>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-hairline-soft flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => update(DEFAULT_MEDIA_SETTINGS, "All settings reset")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset all
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobilePreviewOpen(true)}
              className="md:hidden inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-hairline bg-white text-xs font-bold text-ink hover:bg-surface-soft transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-rausch hover:bg-rausch-active text-white active:scale-95 transition-all shadow-sm"
            >
              Done
            </button>
          </div>
        </div>

        {/* Mobile preview sheet */}
        {mobilePreviewOpen && (
          <div className="md:hidden absolute inset-0 z-10 flex items-end">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobilePreviewOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-label="Live preview"
              className="relative w-full max-h-[85%] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-airbnb"
            >
              <div className="flex justify-end mb-1">
                <button
                  type="button"
                  onClick={() => setMobilePreviewOpen(false)}
                  className="w-8 h-8 rounded-full bg-surface-soft border border-hairline text-ink flex items-center justify-center"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-w-[260px] mx-auto">
                <SettingsPreview
                  settings={current}
                  avatar={selectedAvatar}
                  showDuaScene={activeTab === "dua"}
                />
              </div>
            </div>
          </div>
        )}

        {/* Undo toast */}
        {toast && (
          <div
            role="status"
            className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-3 pl-4 pr-2 py-2 rounded-full bg-ink text-white text-xs font-semibold shadow-airbnb"
          >
            <span className="whitespace-nowrap">{toast.message}</span>
            <button
              type="button"
              onClick={handleUndo}
              className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 font-bold"
            >
              Undo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
