"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToastKind = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  action?: ToastAction;
  /** ms before auto-dismiss; 0 keeps it until closed. */
  duration?: number;
}

export type PushToast = (toast: Omit<Toast, "id">) => number;

const MAX_VISIBLE = 4;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback<PushToast>(
    (toast) => {
      const id = ++nextId.current;
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { ...toast, id }]);
      // Errors linger longer so there's time to hit Retry.
      const duration = toast.duration ?? (toast.kind === "error" ? 10000 : 5000);
      if (duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration));
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => clearTimeout(t));
  }, []);

  return { toasts, push, dismiss };
}
