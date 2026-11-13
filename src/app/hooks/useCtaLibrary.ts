"use client";

import { useEffect, useState } from "react";
import { EMPTY_CTA_LIBRARY, type CtaLibrary } from "@/app/utils/cta-shared";

// Fetched once per page load and shared by every caller (settings picker,
// storyboard preview).
let libraryPromise: Promise<CtaLibrary> | null = null;

function fetchCtaLibrary(): Promise<CtaLibrary> {
  if (!libraryPromise) {
    libraryPromise = fetch("/api/list-cta")
      .then((res) => res.json())
      .then((data) => ({ ...EMPTY_CTA_LIBRARY, ...(data.library || {}) }))
      .catch(() => {
        libraryPromise = null; // allow a retry on the next mount
        return EMPTY_CTA_LIBRARY;
      });
  }
  return libraryPromise;
}

export function useCtaLibrary(): CtaLibrary {
  const [library, setLibrary] = useState<CtaLibrary>(EMPTY_CTA_LIBRARY);
  useEffect(() => {
    let cancelled = false;
    fetchCtaLibrary().then((lib) => {
      if (!cancelled) setLibrary(lib);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return library;
}
