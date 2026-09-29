import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";
import { withRetry } from "@/app/utils/retry";
import { isTranslationTarget, type TranslationTarget } from "@/app/utils/transcript-language";
import type { TranscriptSegment } from "@/app/types/scene";

// Lines per Groq call — small enough that the JSON reply never truncates.
const BATCH_SIZE = 40;
const CANDIDATE_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "groq/compound-mini"];

const TARGET_INSTRUCTIONS: Record<TranslationTarget, string> = {
  english:
    "natural, simple spoken English. Keep Islamic terms that English-speaking Muslims commonly use as-is (Allah, Dua, Sabr, Namaz/Salah, Zikr, Tahajjud, InshaAllah, SubhanAllah, Alhamdulillah, Quran, Hadith, Jannah, etc.)",
  hindi:
    "Hindi written in Devanagari script (e.g. \"हमारे पास वक़्त नहीं है\"). Use everyday spoken Hindustani as heard in Islamic reminders — Urdu-origin words like \"ज़िंदगी\", \"सब्र\", \"दुआ\", \"अल्लाह\" are fine; use nukta (ज़, क़, ख़, ग़, फ़) where natural. Do NOT use Latin/Roman letters or Urdu script",
  urdu:
    "Urdu written in Urdu (Nastaliq/Perso-Arabic) script (e.g. \"ہمارے پاس وقت نہیں ہے\"). Use everyday spoken Urdu vocabulary. Do NOT use Latin/Roman letters or Devanagari script",
};

function getGroqErrorStatus(err: unknown): number | undefined {
  const asRecord = err as { status?: number; response?: { status?: number } } | null;
  return asRecord?.status ?? asRecord?.response?.status;
}

function buildPrompt(lines: string[], target: TranslationTarget): string {
  const numbered = lines.map((line, i) => `[${i}] ${line}`).join("\n");
  return `You are translating the spoken transcript of a short Islamic/spiritual video. Each numbered line is one caption segment spoken at a fixed time.

Translate EVERY line into ${TARGET_INSTRUCTIONS[target]}.

Rules:
- Translate each line on its own, keeping its meaning. Do NOT merge, split, reorder, or skip lines — the timing of each line is fixed.
- Keep it conversational, like a speaker talking to the camera, not a word-for-word literal translation.
- Leave Arabic Quranic verses / Duas as their commonly used transliteration.
- If a line is already in the target language, return it unchanged.

Lines:
${numbered}

Return ONLY a JSON object mapping every line number to its translation, with exactly ${lines.length} entries:
{"lines": {"0": "...", "1": "..."}}`;
}

async function translateBatch(groq: Groq, lines: string[], target: TranslationTarget): Promise<(string | null)[]> {
  const prompt = buildPrompt(lines, target);
  let lastError: Error | null = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const completion = await withRetry(
        () =>
          groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model,
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 4000,
          }),
        { retries: 2, baseDelayMs: 1000, shouldRetry: (err) => getGroqErrorStatus(err) === 429 },
      );
      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from Groq.");
      const parsed = JSON.parse(content);
      const map = (parsed?.lines ?? parsed) as Record<string, unknown>;
      const result = lines.map((_, i) => {
        const value = map?.[String(i)];
        return typeof value === "string" && value.trim() ? value.trim() : null;
      });
      // Accept only if most lines came back; otherwise try the next model.
      const got = result.filter(Boolean).length;
      if (got >= Math.ceil(lines.length * 0.8)) return result;
      throw new Error(`Model returned ${got}/${lines.length} lines.`);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Translation with ${model} failed, trying next candidate:`, lastError.message);
    }
  }
  throw lastError || new Error("Translation failed.");
}

export async function POST(request: Request) {
  try {
    const { segments, text, targetLanguage } = await request.json();

    if (!isTranslationTarget(targetLanguage)) {
      return NextResponse.json({ error: "Invalid target language." }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json(
        { error: "GROQ_API_KEY is missing. Add it to .env.local and restart the dev server." },
        { status: 500 },
      );
    }
    const groq = new Groq({ apiKey });

    const hasSegments = Array.isArray(segments) && segments.length > 0;
    // Without timed segments, translate plain text sentence by sentence.
    const sourceLines: string[] = hasSegments
      ? (segments as TranscriptSegment[]).map((s) => String(s.text || ""))
      : String(text || "")
          .split(/(?<=[.!?।۔])\s+|\n+/)
          .map((l) => l.trim())
          .filter(Boolean);

    if (sourceLines.length === 0) {
      return NextResponse.json({ error: "Transcript is empty." }, { status: 400 });
    }

    const translated: string[] = [];
    let untranslated = 0;
    for (let i = 0; i < sourceLines.length; i += BATCH_SIZE) {
      const batch = sourceLines.slice(i, i + BATCH_SIZE);
      let result = await translateBatch(groq, batch, targetLanguage);

      // One retry for any lines the model dropped.
      const missing = result.map((v, idx) => (v ? -1 : idx)).filter((idx) => idx >= 0);
      if (missing.length > 0) {
        try {
          const retry = await translateBatch(groq, missing.map((idx) => batch[idx]), targetLanguage);
          result = [...result];
          missing.forEach((idx, k) => {
            if (retry[k]) result[idx] = retry[k];
          });
        } catch {
          // keep originals for the missing lines
        }
      }

      result.forEach((value, idx) => {
        if (!value) untranslated++;
        translated.push(value ?? batch[idx]);
      });
    }

    // Timing is copied from the original segments untouched.
    const translatedSegments: TranscriptSegment[] | undefined = hasSegments
      ? (segments as TranscriptSegment[]).map((s, i) => ({ ...s, text: translated[i] }))
      : undefined;

    return NextResponse.json({
      text: translated.join(" "),
      segments: translatedSegments,
      untranslated,
    });
  } catch (error: unknown) {
    console.error("Error translating transcript:", error);
    const message = error instanceof Error ? error.message : "Failed to translate transcript.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
