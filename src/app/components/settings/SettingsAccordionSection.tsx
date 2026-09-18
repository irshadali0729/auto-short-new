"use client";

import React from "react";
import { ChevronDown } from "lucide-react";

interface SettingsAccordionSectionProps {
  id: string;
  title: string;
  icon: React.ElementType;
  summary?: React.ReactNode;
  isOpen: boolean;
  onToggle: (id: string) => void;
  sectionRef?: (el: HTMLDivElement | null) => void;
  children: React.ReactNode;
}

export default function SettingsAccordionSection({
  id,
  title,
  icon: Icon,
  summary,
  isOpen,
  onToggle,
  sectionRef,
  children,
}: SettingsAccordionSectionProps) {
  const panelId = `settings-section-panel-${id}`;
  const headerId = `settings-section-header-${id}`;

  return (
    <div
      ref={sectionRef}
      data-section-id={id}
      className="rounded-xl border border-hairline-soft overflow-hidden bg-white scroll-mt-4"
    >
      <button
        type="button"
        id={headerId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-surface-soft transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className="w-4 h-4 text-rausch shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-bold text-ink uppercase tracking-wider block">
              {title}
            </span>
            {summary && (
              <span className="text-xs text-muted block mt-0.5 truncate">
                {summary}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="px-4 pb-4 pt-1 space-y-3 animate-in fade-in duration-150"
        >
          {children}
        </div>
      )}
    </div>
  );
}
