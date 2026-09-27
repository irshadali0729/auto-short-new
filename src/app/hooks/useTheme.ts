"use client";

import { useCallback, useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "auto_shorts_theme";

// layout.tsx applies the saved theme before paint; this hook only mirrors
// the current <html class="dark"> state and toggles it.
export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggle = useCallback(() => {
    const next = document.documentElement.classList.toggle("dark") ? "dark" : "light";
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
  }, []);

  return { theme, toggle };
}
