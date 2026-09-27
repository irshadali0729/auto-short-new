"use client";

import React from "react";
import { Film, History, Moon, Settings, Sun } from "lucide-react";

export default function TopNav({
  theme,
  onToggleTheme,
  onOpenHistory,
  onOpenSettings,
  settingsSummary,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  settingsSummary: string;
}) {
  const iconBtn =
    "inline-flex items-center justify-center w-10 h-10 rounded-full border border-hairline bg-canvas hover:bg-surface-soft text-ink transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink";

  return (
    <nav className="sticky top-0 z-40 h-16 sm:h-20 bg-canvas/95 backdrop-blur border-b border-hairline-soft px-4 sm:px-8 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-10 h-10 rounded-full bg-[#fff0f2] flex items-center justify-center text-rausch shrink-0">
          <Film className="w-5 h-5" />
        </div>
        <span className="font-bold text-lg text-ink tracking-tight">
          auto-<span className="text-rausch">short</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={onOpenHistory} className={iconBtn} aria-label="Generation history" title="History">
          <History className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className={iconBtn}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          id="settings-open-button"
          className="inline-flex items-center gap-2 h-10 px-3 sm:px-4 rounded-full border border-hairline bg-canvas hover:bg-surface-soft text-ink text-xs font-semibold transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          aria-label="Open settings"
        >
          <Settings className="w-4 h-4 text-rausch" />
          <span className="hidden sm:inline">Settings</span>
          <span className="hidden md:inline text-muted font-medium">· {settingsSummary}</span>
        </button>
      </div>
    </nav>
  );
}
