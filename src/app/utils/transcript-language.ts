// Transcript language detection + the translation targets offered for each
// source language. Shared by the client (InputPanel/page.tsx) and the
// /api/translate-transcript route.

export type TranscriptLanguage = "english" | "hindi" | "urdu";
export type TranslationTarget = TranscriptLanguage;

export const TRANSCRIPT_LANGUAGE_LABELS: Record<TranscriptLanguage, string> = {
  english: "English",
  hindi: "Hindi",
  urdu: "Urdu",
};

export const TRANSLATION_TARGET_LABELS = TRANSCRIPT_LANGUAGE_LABELS;

// Each source language offers the two other languages.
export const TRANSLATION_OPTIONS: Record<TranscriptLanguage, TranslationTarget[]> = {
  english: ["hindi", "urdu"],
  hindi: ["english", "urdu"],
  urdu: ["english", "hindi"],
};

export function isTranslationTarget(value: unknown): value is TranslationTarget {
  return value === "english" || value === "hindi" || value === "urdu";
}

/**
 * Script-based detection: Devanagari → Hindi, Arabic script → Urdu,
 * anything else (Latin) → English.
 */
export function detectTranscriptLanguage(text: string): TranscriptLanguage {
  const devanagari = (text.match(/[ऀ-ॿ]/g) || []).length;
  const arabic = (text.match(/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (devanagari > 0 && devanagari >= arabic && devanagari >= latin * 0.3) return "hindi";
  if (arabic > 0 && arabic >= latin * 0.3) return "urdu";
  return "english";
}
