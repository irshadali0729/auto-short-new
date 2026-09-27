"use client";

import React, { useState } from "react";
import { Check, ChevronDown, RotateCcw } from "lucide-react";

const CARD_ON = "bg-[#fff8f9] border-rausch shadow-airbnb";
const CARD_OFF =
  "bg-white border-hairline hover:border-border-strong hover:bg-surface-soft";

export function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`w-10 h-6 rounded-full transition-colors flex items-center p-0.5 shrink-0 ${
        on ? "bg-rausch" : "bg-zinc-300"
      }`}
    >
      <span
        className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
          on ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </span>
  );
}

export function ToggleCard({
  checked,
  onChange,
  title,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description?: string;
  icon?: React.ElementType;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-full text-left flex items-center gap-3.5 p-4 rounded-xl border transition-all ${
        checked ? CARD_ON : CARD_OFF
      }`}
    >
      <div className="flex-grow min-w-0">
        <span className="text-sm font-bold text-ink flex items-center gap-1.5">
          {Icon && (
            <Icon className={`w-4 h-4 ${checked ? "text-rausch" : "text-muted"}`} />
          )}
          {title}
        </span>
        {description && (
          <p className="text-xs text-muted leading-relaxed mt-0.5">{description}</p>
        )}
      </div>
      <Switch on={checked} />
    </button>
  );
}

export function ChoiceGroup({
  label,
  cols = 3,
  children,
}: {
  label: string;
  cols?: 2 | 3 | 4;
  children: React.ReactNode;
}) {
  const colClass =
    cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3";
  return (
    <div role="radiogroup" aria-label={label} className={`grid grid-cols-2 ${colClass} gap-2.5`}>
      {children}
    </div>
  );
}

export function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  leading,
  trailing,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`relative text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
        selected ? CARD_ON : CARD_OFF
      }`}
    >
      {selected && (
        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-rausch text-white flex items-center justify-center">
          <Check className="w-2.5 h-2.5 stroke-[3.5]" />
        </span>
      )}
      {(leading || trailing) && (
        <div className="flex items-center justify-between gap-1 pr-5">
          {leading}
          {trailing}
        </div>
      )}
      <div className="pr-4">
        <span className="text-xs font-bold text-ink block leading-tight">{title}</span>
        {description && (
          <span className="text-[11px] text-muted block mt-0.5 leading-tight">
            {description}
          </span>
        )}
      </div>
    </button>
  );
}

// Mini phone frame with the chosen third highlighted ("center" = "middle").
export function PositionGlyph({ position, active }: { position: string; active: boolean }) {
  const slot = position === "center" ? "middle" : position;
  return (
    <span className="w-5 h-7 rounded border border-hairline bg-surface-soft flex flex-col justify-between p-0.5">
      {["top", "middle", "bottom"].map((p) => (
        <span
          key={p}
          className={`h-1 w-full rounded-[1px] ${
            p === slot ? (active ? "bg-rausch" : "bg-ink") : "bg-hairline"
          }`}
        />
      ))}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h4 className="text-xs font-bold text-ink uppercase tracking-wide">{label}</h4>
        {hint && <p className="text-[11px] text-muted mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function RangeField({
  id,
  label,
  value,
  min,
  max,
  step,
  format,
  marks,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  marks: [string, string, string];
  onChange: (v: number) => void;
}) {
  return (
    <div className="p-4 rounded-xl border border-hairline bg-surface-soft/60 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <label htmlFor={id} className="text-xs font-bold text-ink uppercase tracking-wider">
          {label}
        </label>
        <span className="px-2 py-0.5 rounded-md bg-[#fff0f2] border border-[#ffd1da] text-rausch text-xs font-bold tabular-nums">
          {format(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-hairline rounded-lg appearance-none cursor-pointer accent-[#ff385c] outline-none focus-visible:ring-2 focus-visible:ring-rausch"
        aria-valuetext={format(value)}
      />
      <div className="flex justify-between text-[10px] text-muted font-medium">
        {marks.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}

export function AdvancedSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-hairline-soft">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-muted uppercase tracking-wide hover:text-ink hover:bg-surface-soft rounded-xl transition-colors"
      >
        Advanced
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 space-y-4 animate-in fade-in duration-150">{children}</div>}
    </div>
  );
}

export function TabHeader({
  title,
  description,
  canReset,
  onReset,
}: {
  title: string;
  description: string;
  canReset: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-bold text-ink">{title}</h3>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={onReset}
        disabled={!canReset}
        className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink disabled:opacity-40 disabled:hover:text-muted transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Reset tab
      </button>
    </div>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-muted p-3 rounded-xl bg-surface-soft border border-hairline-soft">
      {children}
    </p>
  );
}
