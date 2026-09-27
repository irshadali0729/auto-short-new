"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import type { Toast } from "@/app/hooks/useToasts";

const KIND_STYLE: Record<Toast["kind"], { icon: React.ElementType; accent: string }> = {
  success: { icon: CheckCircle2, accent: "text-emerald-600" },
  error: { icon: AlertCircle, accent: "text-rausch" },
  info: { icon: Info, accent: "text-sky-600" },
};

export default function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      // Sits above the sticky action bar.
      className="fixed z-[60] bottom-24 inset-x-4 sm:left-auto sm:right-6 sm:w-96 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => {
        const { icon: Icon, accent } = KIND_STYLE[t.kind];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border border-hairline bg-canvas shadow-airbnb-hover"
            style={{ animation: "toast-in 160ms ease-out" }}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${accent}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink">{t.title}</p>
              {t.message && <p className="text-xs text-muted mt-0.5 break-words">{t.message}</p>}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    onDismiss(t.id);
                  }}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-rausch hover:bg-rausch-active text-white text-xs font-bold transition-colors"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="w-7 h-7 -mr-1 -mt-1 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-surface-soft shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      <style>{`@keyframes toast-in { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
    </div>
  );
}
