"use client";

import React from "react";
import { Check } from "lucide-react";

export type DashboardStep = 1 | 2 | 3 | 4;

const STEPS: { step: DashboardStep; label: string }[] = [
  { step: 1, label: "Transcript" },
  { step: 2, label: "Scenes" },
  { step: 3, label: "Preview" },
  { step: 4, label: "Export" },
];

export default function StepIndicator({
  current,
  maxReached,
  onStepClick,
}: {
  current: DashboardStep;
  /** Highest step the project has unlocked; later steps are not clickable. */
  maxReached: DashboardStep;
  onStepClick: (step: DashboardStep) => void;
}) {
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center gap-1 sm:gap-2">
        {STEPS.map(({ step, label }, i) => {
          const isDone = step < current;
          const isCurrent = step === current;
          const reachable = step <= maxReached;
          return (
            <li key={step} className="flex items-center gap-1 sm:gap-2 flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => onStepClick(step)}
                disabled={!reachable}
                aria-current={isCurrent ? "step" : undefined}
                className="flex items-center gap-2 min-w-0 disabled:cursor-not-allowed group"
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    isCurrent
                      ? "bg-rausch text-white"
                      : isDone
                        ? "bg-ink text-white"
                        : "bg-surface-strong text-muted"
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step}
                </span>
                <span
                  className={`text-xs sm:text-sm font-semibold truncate ${
                    isCurrent ? "text-ink" : reachable ? "text-muted group-hover:text-ink" : "text-muted/60"
                  } ${isCurrent ? "" : "hidden sm:inline"}`}
                >
                  {label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`h-0.5 flex-1 rounded-full ${step < current ? "bg-ink" : "bg-hairline"}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
