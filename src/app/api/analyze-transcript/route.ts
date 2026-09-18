import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";
import { resolveEmojiForText } from "@/app/utils/emoji-resolver";
import { rescaleSceneDurations } from "@/app/utils/scene-timing";
import { withRetry } from "@/app/utils/retry";
import type {
  GraphicBeat,
  TranscriptSegment,
  CaptionSlice,
  DuaInfo,
} from "@/app/types/scene";

export type { GraphicBeat, TranscriptSegment, CaptionSlice } from "@/app/types/scene";

function getGroqErrorStatus(err: unknown): number | undefined {
  const asRecord = err as { status?: number; response?: { status?: number } } | null;
  return asRecord?.status ?? asRecord?.response?.status;
}

function buildGraphicBeats(
  transcript: string,
  duration: number,
  segments?: TranscriptSegment[],
): GraphicBeat[] {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 6;
  const cleanedTranscript = transcript.replace(/\s+/g, " ").trim();
  const words = cleanedTranscript.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    return [
      {
        prefixText: "",
        heroWord: "FOCUS",
        style: "stacked-kinetic",
        start: 0.4,
        end: Math.min(safeDuration * 0.8, 2.5),
      },
    ];
  }

  // Preserve the exact language and words from the transcript
  const beat1Words = words.slice(0, Math.min(words.length, 4));
  const hero1 = beat1Words[beat1Words.length - 1] || "FOCUS";
  const prefix1 = beat1Words.slice(0, -1).join(" ");

  const beats: GraphicBeat[] = [
    {
      prefixText: prefix1 || undefined,
      heroWord: hero1,
      style: "stacked-kinetic",
      text: beat1Words.join(" "),
      accent: hero1,
      start: 0.3,
      end: Math.min(safeDuration * 0.45, 2.2),
    },
  ];

  if (words.length > 4 && safeDuration > 3) {
    const beat2Words = words.slice(4, Math.min(words.length, 8));
    const hero2 = beat2Words[beat2Words.length - 1] || beat2Words[0];
    const prefix2 = beat2Words.slice(0, -1).join(" ");
    beats.push({
      prefixText: prefix2 || undefined,
      heroWord: hero2,
      style: "stacked-kinetic",
      text: beat2Words.join(" "),
      accent: hero2,
      start: Math.min(safeDuration * 0.5, safeDuration - 2),
      end: Math.min(safeDuration * 0.9, safeDuration - 0.2),
    });
  }

  return beats;
}

function normalizeSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (!segments || segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  return sorted.map((seg, idx) => {
    const nextSeg = sorted[idx + 1];
    const rawEnd = Number.isFinite(seg.end) && seg.end > seg.start ? seg.end : seg.start + (seg.duration || 0);
    // In YouTube transcripts, segments overlap on screen for readability.
    // The actual spoken span of segment i concludes when nextSeg starts speaking.
    const effectiveEnd = nextSeg && nextSeg.start > seg.start && nextSeg.start < rawEnd
      ? nextSeg.start
      : rawEnd;
    const effectiveDuration = Number(Math.max(0.5, effectiveEnd - seg.start).toFixed(2));
    return {
      ...seg,
      duration: effectiveDuration,
      end: Number(effectiveEnd.toFixed(2)),
    };
  });
}

function alignScenesToSegments(
  scenes: GroqScene[],
  rawSegments: TranscriptSegment[],
): GroqScene[] {
  if (!rawSegments || rawSegments.length === 0) return scenes;
  const segments = normalizeSegments(rawSegments);

  const numScenes = scenes.length;
  const numSegments = segments.length;
  if (numScenes === 0) return scenes;

  let currentSegmentIdx = 0;

  return scenes.map((scene, sceneIdx) => {
    const isFirstScene = sceneIdx === 0;
    const isLastScene = sceneIdx === numScenes - 1;
    const segStart = currentSegmentIdx;

    const remainingScenes = numScenes - sceneIdx;
    const remainingSegments = numSegments - currentSegmentIdx;

    const segmentsForThisScene = isLastScene
      ? Math.max(1, remainingSegments)
      : Math.max(1, Math.round(remainingSegments / remainingScenes));

    const segEnd = isLastScene
      ? numSegments - 1
      : Math.min(numSegments - 1, currentSegmentIdx + segmentsForThisScene - 1);

    currentSegmentIdx = segEnd + 1;

    // First scene starts from 0.0s to ensure no silent initial blank freeze
    const sceneStartTime = isFirstScene ? 0 : (segments[segStart]?.start ?? 0);
    const sceneEndTime = isLastScene
      ? (segments[numSegments - 1]?.end ?? (sceneStartTime + 5))
      : (segments[segEnd]?.end ?? (sceneStartTime + 5));

    const accurateDuration = Number(
      Math.max(1.0, sceneEndTime - sceneStartTime).toFixed(2),
    );

    const alignedGraphics = (scene.graphics || []).map((beat) => {
      const hero = String(beat.heroWord || beat.accent || "").trim().toLowerCase();

      let matchedSegment = segments[segStart];
      for (let s = segStart; s <= segEnd; s++) {
        if (segments[s]?.text.toLowerCase().includes(hero)) {
          matchedSegment = segments[s];
          break;
        }
      }

      const relStart = Math.max(
        0,
        (matchedSegment?.start ?? sceneStartTime) - sceneStartTime,
      );
      const relDuration = Math.max(0.8, matchedSegment?.duration ?? 1.5);
      const relEnd = Math.min(
        accurateDuration,
        Math.max(relStart + 0.8, relStart + relDuration),
      );

      return {
        ...beat,
        start: Number(relStart.toFixed(2)),
        end: Number(relEnd.toFixed(2)),
      };
    });

    const sceneCaptions: CaptionSlice[] = [];
    for (let s = segStart; s <= segEnd; s++) {
      if (segments[s]) {
        const relStart = Math.max(0, segments[s].start - sceneStartTime);
        const relEnd = Math.min(
          accurateDuration,
          Math.max(relStart + 0.5, segments[s].end - sceneStartTime),
        );
        const sliceEmoji =
          resolveEmojiForText(segments[s].text) || scene.emoji;
        sceneCaptions.push({
          text: segments[s].text,
          start: Number(relStart.toFixed(2)),
          end: Number(relEnd.toFixed(2)),
          emoji: sliceEmoji,
        });
      }
    }

    return {
      ...scene,
      duration: accurateDuration,
      graphics: alignedGraphics.length > 0 ? alignedGraphics : undefined,
      captions: sceneCaptions.length > 0 ? sceneCaptions : undefined,
    };
  });
}

interface GroqScene {
  keyword: string;
  duration: number;
  prompt: string;
  visualQuery?: string;
  fallbackQuery?: string;
  moodQuery?: string;
  emoji?: string;
  graphics?: GraphicBeat[];
  tags?: string[];
  caption?: string;
  captions?: CaptionSlice[];
  duaInfo?: DuaInfo;
}

function extractAndParseScenes(rawContent: string): GroqScene[] {
  if (!rawContent || typeof rawContent !== "string") {
    throw new Error("Empty response received from Groq API.");
  }

  let cleaned = rawContent.trim();
  // 1. Remove markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "")
      .trim();
  }

  // 2. Extract outermost JSON { ... }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 3. Direct JSON.parse
  try {
    const data = JSON.parse(cleaned);
    if (data.scenes && Array.isArray(data.scenes) && data.scenes.length > 0) {
      console.log("[analyze-transcript] Parsed scenes via strategy 3 (direct JSON.parse).");
      return data.scenes;
    }
  } catch (err) {
    console.warn("[analyze-transcript] Strategy 3 (direct JSON.parse) failed:", (err as Error).message);
  }

  // 4. Sanitize unescaped control chars / literal newlines in strings
  try {
    const sanitized = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => {
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      return "";
    });
    const data = JSON.parse(sanitized);
    if (data.scenes && Array.isArray(data.scenes) && data.scenes.length > 0) {
      console.log("[analyze-transcript] Parsed scenes via strategy 4 (control-char sanitize).");
      return data.scenes;
    }
  } catch (err) {
    console.warn("[analyze-transcript] Strategy 4 (control-char sanitize) failed:", (err as Error).message);
  }

  // 5. Regex extraction of valid completed scene objects if truncated
  const sceneObjects: GroqScene[] = [];
  const sceneRegex = /\{\s*"keyword"\s*:\s*"([^"]+)"[\s\S]*?\}(?=\s*[,\]])/g;
  let match;
  while ((match = sceneRegex.exec(cleaned)) !== null) {
    try {
      const sc = JSON.parse(match[0]);
      if (sc.keyword) sceneObjects.push(sc);
    } catch (err) {
      console.warn("[analyze-transcript] Strategy 5 (regex scene extraction) skipped a malformed match:", (err as Error).message);
    }
  }
  if (sceneObjects.length > 0) {
    console.log(`[analyze-transcript] Parsed ${sceneObjects.length} scene(s) via strategy 5 (regex extraction).`);
    return sceneObjects;
  }

  // 6. Auto-closing repair for truncated JSON
  try {
    let repaired = cleaned;
    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) repaired += '"';
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";
    const data = JSON.parse(repaired);
    if (data.scenes && Array.isArray(data.scenes) && data.scenes.length > 0) {
      console.log("[analyze-transcript] Parsed scenes via strategy 6 (auto-closing brace repair).");
      return data.scenes;
    }
  } catch (err) {
    console.warn("[analyze-transcript] Strategy 6 (auto-closing brace repair) failed:", (err as Error).message);
  }

  console.error("[analyze-transcript] All 6 JSON-repair strategies failed to parse Groq's response.");
  throw new Error("Groq returned invalid or unparseable scene data.");
}

// Groq's response is free-form JSON from an LLM — before it flows into the video
// pipeline, clamp it to sane bounds instead of trusting it outright. Individual
// fields already have ad hoc `|| 5` style fallbacks for missing/NaN values, but
// those don't catch a technically-valid-but-absurd value (e.g. a 400 second
// scene, or 60 scenes for a 20 second video).
const MIN_SCENE_DURATION_SEC = 1;
const MAX_SCENE_DURATION_SEC = 30;
const MAX_SCENE_COUNT = 20;

function sanitizeScenes(scenesIn: GroqScene[]): GroqScene[] {
  if (!Array.isArray(scenesIn) || scenesIn.length === 0) {
    throw new Error("Groq returned no usable scenes.");
  }

  let sanitized = scenesIn.map((scene) => ({
    ...scene,
    duration: Math.min(
      MAX_SCENE_DURATION_SEC,
      Math.max(
        MIN_SCENE_DURATION_SEC,
        Number.isFinite(scene.duration) ? scene.duration : 5,
      ),
    ),
  }));

  if (sanitized.length > MAX_SCENE_COUNT) {
    console.warn(
      `Groq returned ${sanitized.length} scenes, truncating to ${MAX_SCENE_COUNT}.`,
    );
    sanitized = sanitized.slice(0, MAX_SCENE_COUNT);
  }

  return sanitized;
}

// Shared verbatim between buildLegacyPrompt and buildRelatableVisualPrompt —
// previously copy-pasted in both, which meant a fix or new correction example
// (like the ones added for specific misheard Duas) had to be applied twice.
const DUA_DETECTION_RULE_BLOCK = `* DUA / ZIKR DETECTION & AUTOMATIC CORRECTION RULE (CRITICAL):
  - Speech-to-text transcripts frequently contain imperfect, phonetic, incomplete, or misspelled Hindi/Urdu Duas (e.g. "ला हौला वला कुता", "हसबुन वल वकील", "ला इलाहा इल्ला अता सुभान का", "अस्तगफिरुल्ला", "अल्लाह इन असलका हुब्बक व्हि व अमलदी हुब्बक", etc.).
  - NEVER copy or output the broken/imperfect text from the transcript into "duaInfo"!
  - You MUST identify the intended authentic Dua/Zikr from Islamic tradition and respond with the 100% complete, verified, and grammatically perfect version:
    * "hindi" (string): The complete, 100% correct authentic Hindi (Devanagari) pronunciation (e.g. if transcript says "ला हौला वला कुता", correct it to "ला हौल वला क़ुव्वत इल्ला बिल्लाहिल 'अलिय्यिल 'अज़ीम"; if transcript says "हसबुन वल वकील", correct it to "हसबुनल्लाहु व निअमल वकील"; if transcript says "अल्लाह इन असलका हुब्बक व्हि व अमलदी हुब्बक", correct it to "अल्लाहुम्मा इन्नी अस्अलुका हुब्बक, व हुब्ब मन युहिब्बुक, वल अमलल्लज़ी युबल्लिग़ुनी हुब्बक" — the Tirmidhi Dua for the love of Allah).
    * "arabic" (string): The authentic, complete Arabic text with full Tashkeel / Harakat (e.g. "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ" / "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ" / "اللَّهُمَّ إِنِّي أَسْأَلُكَ حُبَّكَ، وَحُبَّ مَنْ يُحِبُّكَ، وَالْعَمَلَ الَّذِي يُبَلِّغُنِي حُبَّكَ").
    * "title" (string, optional): Short spiritual title (e.g. "हिफ़ाज़त की दुआ / Protection Dua").
    * "reference" (string, optional): Authentic Quran or Hadith source (e.g. "Sahih Bukhari / Abu Dawud").
    * "isDua" (boolean): true
  - If a scene contains a Dua, you MUST include this "duaInfo" object on that scene. This is a strict rule with ZERO exceptions: never silently skip "duaInfo" for a scene that recites/discusses a Dua, no matter how short the video, how many other scenes exist, or how limited the output length is. If you are running low on output space, shorten "caption"/"prompt" text rather than dropping any "duaInfo".
  - MULTIPLE DUAS RULE: If the transcript lists more than one Dua (e.g. "नंबर एक...", "नंबर दो...", "नंबर तीन...", "पहली दुआ", "दूसरी दुआ", or any enumerated/numbered list of Duas), you MUST create a SEPARATE scene for EACH individual Dua, and EVERY one of those scenes MUST have its own corrected "duaInfo" object. Do NOT merge multiple Duas into a single scene, and do NOT leave any listed Dua without a "duaInfo" object — apply the same imperfect-to-authentic correction to each one independently.
  - SELF-CHECK BEFORE RESPONDING: Count how many distinct Duas/Zikr are recited in the transcript. Before finalizing your JSON, verify that the exact same number of scenes contain a "duaInfo" object. If the counts don't match, fix your output before returning it.`;

function buildLegacyPrompt(
  transcript: string,
  targetLength: number | undefined,
  formattedSegmentsText: string,
  hasSegments: boolean,
): string {
  return `You are creating Islamic YouTube Shorts.
Analyze the transcript.
Extract visual scenes.
Return English keywords, durations, and highly detailed anime-style image generation prompts.

Rules:
* Return valid JSON only without markdown or code fences.
* Do not use unescaped quotes or raw newlines inside string values.
* Return a JSON object with a single key "scenes" which contains an array of objects.
* Each scene object must have:
  - "keyword" (string): Simple visual keyword (max 2 words).
  - "emoji" (string): A single high-impact emotional/spiritual emoji (e.g. "🤲", "💔", "✨", "⏳", "🔥", "⚠️", "💰").
  - "duration" (number): Scene duration in seconds.
  - "prompt" (string): A detailed text-to-image prompt. It must describe a clean, beautiful scene in "cinematic anime style" reflecting the transcript beat, and end with the exact words: "vertical 9:16 aspect ratio, soft lighting, highly detailed, 1k".
  - "tags" (array of strings): 3-5 short visual keywords or synonyms (order by relevance). These will be used to expand image search queries (e.g., ["muslim_woman", "hijab", "prayer"]).
  - "caption" (string): A short, human-readable caption describing the desired image (10-20 words).
  - "graphics" (array of objects): 1-2 emphasis overlay beats per scene.
    * CRITICAL LANGUAGE RULE: The words inside "graphics" (prefixText, heroWord, suffixText) MUST STRICTLY BE IN THE EXACT SAME LANGUAGE AND SCRIPT AS THE INPUT TRANSCRIPT!
      - If transcript is Hindi (Devanagari): use Hindi (Devanagari) words (e.g. prefixText: "हमारे पास", heroWord: "वक़्त").
      - If transcript is Hinglish / Romanized Hindi/Urdu: use Hinglish words (e.g. prefixText: "Hamare paas", heroWord: "waqt").
      - If transcript is English: use English words (e.g. prefixText: "I don't have", heroWord: "time.").
      - DO NOT translate graphics words to English if the transcript is in Hindi or Hinglish!
    * Each graphic beat must include:
      - "prefixText" (string): 1-4 context words in crisp white with black outline.
      - "heroWord" (string): The single most important emphasis punchline word rendered in giant golden/orange gradient.
      - "suffixText" (string, optional): Trailing context words if needed.
      - "style" (string): "stacked-kinetic" (default 2-line/3-line text), "top-hero" (giant hero word on top + question/context below), or "thought-bubble" (for internal quotes/dialogue).
      - "start" (number): Start timestamp in seconds within this scene (e.g., 0.3).
      - "end" (number): End timestamp in seconds within this scene (e.g., 2.2).
* Keywords and tags must be visual.
* Since these are Islamic shorts, prepend "Muslim" or "Islamic" or configure Islamic context for keywords, characters, and activities to ensure visual relevance (e.g. use "Muslim woman" instead of "woman", "Islamic prayer" instead of "prayer", "Muslim husband" instead of "husband", "Muslim couple" instead of "love", "Muslim peace" instead of "peace").
* The prompts should depict respectful, modest, and beautiful anime art.
* Generate 5-10 scenes.
${
  hasSegments
    ? `* REAL AUDIO SEGMENTS WITH EXACT TIMESTAMPS:
${formattedSegmentsText}

CRITICAL TIMELINE SYNCHRONIZATION RULES:
- The video has exact audio timestamps provided in the segments above.
- You MUST align the scenes to these exact audio segments.
- The "duration" of each scene MUST match the exact duration of the segments it covers (e.g., if Scene 1 covers 0.00s to 4.90s, duration is 4.90).
- For graphic beats, set "start" and "end" relative to that scene's start time matching when the heroWord is spoken in the segment.`
    : targetLength
      ? `* The total duration of all scenes combined must be exactly ${targetLength} seconds. Adjust the duration of individual scenes (which must be numbers) so they sum up to exactly ${targetLength}.`
      : "* Total duration of all scenes combined should ideally be between 15 to 45 seconds."
}

${DUA_DETECTION_RULE_BLOCK}

Example output:
{
  "scenes": [
    {
      "keyword": "Prophetic Dua",
      "emoji": "🤲",
      "duration": 5, 
      "tags": ["dua", "supplication", "light"],
      "caption": "A person raising hands in heartfelt supplication during serene sunrise.",
      "graphics": [
        {"prefixText":"मुश्किल वक्त की","heroWord":"दुआ","style":"stacked-kinetic","start":0.4,"end":2.4}
      ],
      "duaInfo": {
        "isDua": true,
        "hindi": "ला इलाहा इल्ला अन्ता सुब्हानका इन्नी कुन्तु मिनज़-ज़ालिमीन",
        "arabic": "لَا إِلٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
        "title": "मुश्किल वक्त की दुआ / Ayat-e-Kareema",
        "reference": "Surah Al-Anbiya (21:87)"
      },
      "prompt": "An elegant anime style illustration of hands raised in prayer under soft golden morning light, vertical 9:16 aspect ratio, soft lighting, highly detailed, 1k" 
    }
  ]
}

Transcript:
${transcript}`;
}

function buildRelatableVisualPrompt(
  transcript: string,
  targetLength: number | undefined,
  formattedSegmentsText: string,
  hasSegments: boolean,
): string {
  return `You are an expert cinematic director creating viral, highly engaging Islamic YouTube Shorts.
Analyze the transcript and break it down into visually striking, relatable scenes.
Translate the metaphorical, spiritual, and emotional essence into concrete, photogenic camera shots that real photographers shoot for stock media (Pexels, Pixabay, Unsplash).

CRITICAL VISUAL METAPHOR & STOCK SEARCH RULES:
* Western stock libraries (Pexels, Pixabay, Unsplash) DO NOT understand Hindi/Urdu idioms or spiritual abstractions (e.g., 'dil dukhaya', 'gunah', 'maghfirat', 'tawbah', 'haq', 'namaz chhoot jaye', 'forgiveness', 'broken heart', 'sharab ki aadat').
* Searching literal translations like "dil dukhaya Muslim" or "broken heart Muslim" completely fails or returns cheesy dating breakup photos.
* You MUST translate spiritual concepts into concrete physical camera shots in English:
  - "दिल दुखाया" (Hurting someone's feelings/heart) -> "thoughtful lonely man dark cinematic lighting" OR "sad man sitting in shadows deep thought"
  - "नमाज़ छूट जाए" (Missed prayer/remorse) -> "muslim man praying silhouette sunset" OR "man prostrating prayer silhouette"
  - "शराब की लत / नशा" (Addiction / Sins) -> "sad depressed man sitting alone at table with bottle" OR "alcoholic man sitting at table head in hands"
  - "मां-बाप की नाफ़रमानी" (Disrespecting parents) -> "elderly sad person sitting alone looking out window" OR "sorrowful elderly mother silhouette"
  - "अल्लाह माफ़ कर सकता है" (Allah's mercy/forgiveness) -> "sun rays breaking through dramatic storm clouds" OR "hands raised dua prayer golden hour"
  - "ख़ुदा की क़सम" (Solemn oath / intense warning) -> "dramatic storm clouds lightning cinematic" OR "man walking alone desert dunes sunset"
  - "हक़ूक़ उल इबाद" (Rights of people/trust) -> "two men shaking hands greeting silhouette" OR "crowd silhouettes walking golden hour"
  - Peace & tranquility -> "ancient mosque dome sunset silhouette" OR "kaaba mecca crowd golden hour"
* "visualQuery" (string): 3 to 6 words describing a concrete, physical camera shot in English for stock video/photo search. Focus on physical subjects, setting, and composition (e.g. "sad depressed man sitting alone at table with bottle", "muslim man praying silhouette", "ancient mosque dome sunset"). Avoid ambiguous photographer words like 'dark lighting' or 'bottle lights' that match string lights.
* "fallbackQuery" (string): Secondary concrete physical alternative shot (3-5 words in English) if the primary shot is unavailable (e.g., "ancient mosque architecture dome", "desert sand dunes cinematic sunset").
* "moodQuery" (string): Universal atmospheric backup shot (3-5 words in English) matching the emotional weight (e.g., "dramatic storm clouds sunset sky", "sun rays through clouds golden hour").
* "keyword" (string): Concise 1-3 word human-readable topic label in English for the UI storyboard badge (e.g., "Broken Trust", "Sincere Prayer", "Divine Mercy").
* "emoji" (string): A single high-impact emotional or spiritual emoji for this scene.
  - CRITICAL DIVERSITY RULE: Do NOT repeat the same emoji across scenes! Every scene MUST have a different, specific emoji matching its unique action:
    * Holy Name / Zikr / Tasbih -> "📿" or "🔑"
    * Asking / Dua / Supplication -> "🤲"
    * Acceptance / Divine Gift / Atta / Reward -> "🎁"
    * Love / Beloved / Pyari / Sweetness -> "❤️"
    * Wonder / Praise / SubhanAllah -> "💫"
    * Heartbreak / Pain / Dil dukhana -> "💔"
    * Warning / Solemn Oath -> "⚠️"
    * Time / Urgency / Delay -> "⏳"
    * Fire / Punishment -> "🔥"
    * Light / Mercy / Noor -> "✨"

${DUA_DETECTION_RULE_BLOCK}

General Rules:
* Return valid JSON only without markdown or code fences.
* Do not use unescaped quotes or raw newlines inside string values.
* Return a JSON object with a single key "scenes" which contains an array of objects.
* Each scene object must have:
  - "keyword" (string): 1-3 word English label for UI display.
  - "visualQuery" (string): 3-6 words concrete camera shot in English.
  - "fallbackQuery" (string): 3-5 words secondary camera shot in English.
  - "moodQuery" (string): 3-5 words atmospheric backup shot in English.
  - "emoji" (string): Single high-impact 3D-style emoji (e.g., "💔", "🤲", "🔥", "⏳", "⚠️", "✨", "💰", "💡", "🥀", "😢", "🕌", "👑").
  - "duration" (number): Scene duration in seconds.
  - "prompt" (string): A detailed text-to-image prompt in "cinematic anime style", ending with: "vertical 9:16 aspect ratio, soft lighting, highly detailed, 1k".
  - "tags" (array of strings): 3-5 visual keywords.
  - "caption" (string): Short caption describing the visual shot (10-20 words).
  - "graphics" (array of objects): 1-2 emphasis overlay beats per scene.
    * CRITICAL LANGUAGE RULE: Words inside "graphics" (prefixText, heroWord, suffixText) MUST STRICTLY BE IN THE EXACT SAME LANGUAGE AND SCRIPT AS THE INPUT TRANSCRIPT!
      - If transcript is Hindi: use Hindi (Devanagari) words (e.g. prefixText: "खुदा की कसम", heroWord: "दिल दुखाया").
      - If transcript is Hinglish: use Hinglish words (e.g. prefixText: "Khuda ki qasam", heroWord: "dil dukhaya").
      - If transcript is English: use English words (e.g. prefixText: "I don't have", heroWord: "time.").
      - DO NOT translate graphics words to English if transcript is in Hindi or Hinglish!
    * Each graphic beat must include:
      - "prefixText" (string): 1-4 context words.
      - "heroWord" (string): The single most important emphasis punchline word.
      - "suffixText" (string, optional): Trailing context words.
      - "style" (string): "stacked-kinetic", "top-hero", or "thought-bubble".
      - "start" (number): Start timestamp in seconds within this scene.
      - "end" (number): End timestamp in seconds within this scene.
  - "duaInfo" (object, ONLY when a Dua/Zikr is spoken in this scene):
    * "isDua" (boolean): true
    * "hindi" (string): Verified Hindi text of the Dua.
    * "arabic" (string): Authentic Arabic text with full Harakat.
    * "title" (string, optional): Spiritual title.
    * "reference" (string, optional): Authentic source.
* Generate 5-10 scenes.
${
  hasSegments
    ? `* REAL AUDIO SEGMENTS WITH EXACT TIMESTAMPS:
${formattedSegmentsText}

CRITICAL TIMELINE SYNCHRONIZATION RULES:
- The video has exact audio timestamps provided in the segments above.
- You MUST align the scenes to these exact audio segments.
- The "duration" of each scene MUST match the exact duration of the segments it covers (e.g., if Scene 1 covers 0.00s to 4.90s, duration is 4.90).
- For graphic beats, set "start" and "end" relative to that scene's start time matching when the heroWord is spoken in the segment.`
    : targetLength
      ? `* The total duration of all scenes combined must be exactly ${targetLength} seconds. Adjust the duration of individual scenes (which must be numbers) so they sum up to exactly ${targetLength}.`
      : "* Total duration of all scenes combined should ideally be between 15 to 45 seconds."
}

Example output:
{
  "scenes": [
    {
      "keyword": "Broken Trust",
      "visualQuery": "thoughtful lonely man dark cinematic lighting",
      "fallbackQuery": "man walking alone desert dunes sunset",
      "moodQuery": "dramatic storm clouds sunset sky",
      "emoji": "💔",
      "duration": 5,
      "tags": ["lonely_man", "cinematic", "shadows"],
      "caption": "A solitary thoughtful man seated in moody dramatic lighting reflecting in silence.",
      "graphics": [
        {"prefixText":"खुदा की कसम","heroWord":"दिल दुखाया","style":"stacked-kinetic","start":0.4,"end":2.4}
      ],
      "prompt": "An elegant anime style illustration of a thoughtful man sitting alone in dramatic shadow lighting, vertical 9:16 aspect ratio, soft lighting, highly detailed, 1k"
    },
    {
      "keyword": "Powerful Dua",
      "visualQuery": "hands raised in dua prayer golden sunrise",
      "fallbackQuery": "muslim man praying silhouette sunset",
      "moodQuery": "sun rays through clouds golden hour",
      "emoji": "🤲",
      "duration": 5,
      "tags": ["dua", "supplication", "light"],
      "caption": "Hands raised in earnest supplication asking for relief and mercy under a golden sunrise.",
      "graphics": [
        {"prefixText":"मुश्किल वक्त की","heroWord":"दुआ","style":"stacked-kinetic","start":0.4,"end":2.4}
      ],
      "duaInfo": {
        "isDua": true,
        "hindi": "ला इलाहा इल्ला अन्ता सुब्हानका इन्नी कुन्तु मिनज़-ज़ालिमीन",
        "arabic": "لَا إِلٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
        "title": "मुश्किल वक्त की दुआ / Ayat-e-Kareema",
        "reference": "Surah Al-Anbiya (21:87)"
      },
      "prompt": "An elegant anime style illustration of hands raised in prayer under soft golden morning light, vertical 9:16 aspect ratio, soft lighting, highly detailed, 1k"
    }
  ]
}

Transcript:
${transcript}`;
}

export async function POST(request: Request) {
  try {
    const { transcript, targetLength, segments, useRelatableVisualSearch = true } = await request.json();

    if (
      !transcript ||
      typeof transcript !== "string" ||
      transcript.trim() === ""
    ) {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 },
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    console.log(
      "GROQ_API_KEY check - Is set:",
      !!apiKey,
      "Length:",
      apiKey?.length || 0,
    );

    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json(
        {
          error:
            "Groq API Key is missing. Please configure GROQ_API_KEY in your Railway service variables or .env.local file.",
        },
        { status: 500 },
      );
    }

    const groq = new Groq({
      apiKey: apiKey,
    });

    const hasSegments = Array.isArray(segments) && segments.length > 0;
    const normalizedSegments = hasSegments ? normalizeSegments(segments) : [];
    const formattedSegmentsText = hasSegments
      ? normalizedSegments
          .map(
            (s: TranscriptSegment, idx: number) =>
              `[${idx + 1}] (${s.start.toFixed(2)}s - ${s.end.toFixed(2)}s) "${s.text}"`,
          )
          .join("\n")
      : "";

    // Switch between Relatable Visual Search and Legacy Prompt based on flag
    const prompt = useRelatableVisualSearch !== false
      ? buildRelatableVisualPrompt(transcript, targetLength, formattedSegmentsText, hasSegments)
      : buildLegacyPrompt(transcript, targetLength, formattedSegmentsText, hasSegments);

    const candidateModels = [
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "groq/compound-mini",
    ];

    let responseContent: string | null = null;
    let lastError: Error | null = null;

    for (const model of candidateModels) {
      try {
        // Groq's own rate-limit (429) deserves a short backoff-and-retry on the
        // SAME model since it's a transient "slow down", not a real failure.
        // Any other error (bad request, model down, etc.) falls straight through
        // to the next candidate model instead of wasting retries on it.
        const chatCompletion = await withRetry(
          () =>
            groq.chat.completions.create({
              messages: [
                {
                  role: "user",
                  content: prompt,
                },
              ],
              model,
              response_format: { type: "json_object" },
              // Low temperature keeps rule-following (e.g. always attaching duaInfo)
              // consistent across runs instead of varying scene-to-scene by sampling luck.
              temperature: 0.2,
              // Raised from 3500: with multiple Duas each needing a full corrected
              // hindi+arabic duaInfo block, the previous limit could truncate the JSON
              // mid-scene, silently dropping duaInfo (or whole scenes) near the cutoff.
              max_tokens: 6500,
            }),
          {
            retries: 2,
            baseDelayMs: 1000,
            shouldRetry: (err) => getGroqErrorStatus(err) === 429,
          },
        );

        responseContent = chatCompletion.choices[0]?.message?.content || null;
        if (responseContent) {
          break;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`Model ${model} failed, trying next candidate:`, lastError.message);
      }
    }

    if (!responseContent) {
      throw lastError || new Error("Empty response received from Groq API.");
    }

    const rawScenes = extractAndParseScenes(responseContent);
    let finalScenes: GroqScene[] = rawScenes.map((scene, idx) => ({
      keyword: String(scene.keyword || `scene_${idx + 1}`).trim(),
      duration: Number(scene.duration) || 5,
      prompt: String(
        scene.prompt ||
          `${scene.keyword || "Muslim scene"}, cinematic anime style, vertical 9:16 aspect ratio, soft lighting, highly detailed, 1k`,
      ),
      visualQuery: scene.visualQuery ? String(scene.visualQuery).trim() : undefined,
      fallbackQuery: scene.fallbackQuery ? String(scene.fallbackQuery).trim() : undefined,
      moodQuery: scene.moodQuery ? String(scene.moodQuery).trim() : undefined,
      tags: Array.isArray(scene.tags) ? scene.tags : undefined,
      caption: scene.caption ? String(scene.caption) : undefined,
      graphics: Array.isArray(scene.graphics) ? scene.graphics : undefined,
      duaInfo:
        scene.duaInfo && typeof scene.duaInfo === "object" && scene.duaInfo.isDua
          ? {
              isDua: true,
              hindi: String(scene.duaInfo.hindi || "").trim(),
              arabic: String(scene.duaInfo.arabic || "").trim(),
              title: scene.duaInfo.title ? String(scene.duaInfo.title).trim() : undefined,
              reference: scene.duaInfo.reference ? String(scene.duaInfo.reference).trim() : undefined,
            }
          : undefined,
    }));

    finalScenes = sanitizeScenes(finalScenes);

    if (hasSegments) {
      finalScenes = alignScenesToSegments(finalScenes, segments);
    } else {
      const targetLengthNum = Number(targetLength);
      if (targetLengthNum && !isNaN(targetLengthNum) && targetLengthNum > 0) {
        finalScenes = rescaleSceneDurations(finalScenes, targetLengthNum);
      }
    }

    const usedSceneEmojis = new Set<string>();
    const diverseFallbacks = ["🤲", "📿", "🎁", "❤️", "💫", "✨", "💡", "⏳", "🕊️", "📖"];

    finalScenes = finalScenes.map((scene, sIdx) => {
      const duration = Number(scene.duration) || 6;
      const graphics: GraphicBeat[] =
        Array.isArray(scene.graphics) && scene.graphics.length > 0
          ? scene.graphics.map((beat) => {
              const heroWord = String(beat.heroWord || beat.accent || beat.text || "FOCUS").trim();
              let prefixText = beat.prefixText !== undefined ? String(beat.prefixText).trim() : "";
              if (!prefixText && beat.text && beat.text !== heroWord && beat.text.includes(heroWord)) {
                prefixText = beat.text.replace(heroWord, "").trim();
              }
              const suffixText = beat.suffixText ? String(beat.suffixText).trim() : undefined;
              const style = beat.style || "stacked-kinetic";
              const start = Math.max(0, Number(beat.start) || 0);
              const end = Math.min(
                duration,
                Math.max(start + 0.8, Number(beat.end) || duration),
              );

              return {
                prefixText: prefixText || undefined,
                heroWord,
                suffixText,
                style,
                text: `${prefixText ? prefixText + " " : ""}${heroWord}${suffixText ? " " + suffixText : ""}`.trim(),
                accent: heroWord,
                type: beat.type || "impact",
                start,
                end,
              };
            })
          : buildGraphicBeats(transcript, duration, hasSegments ? segments : undefined);

      const sceneSpokenText =
        (scene.captions || []).map((c) => c.text).join(" ") ||
        scene.caption ||
        scene.keyword ||
        "";

      // 1. Try Groq's assigned emoji if unique
      let sceneEmoji = scene.emoji?.trim() || "";
      if (sceneEmoji && usedSceneEmojis.has(sceneEmoji)) {
        sceneEmoji = ""; // avoid repeating identical emojis across scenes
      }

      // 2. Resolve from actual spoken text (Hindi/Urdu/English) of this scene
      if (!sceneEmoji) {
        const textMatch = resolveEmojiForText(sceneSpokenText);
        if (textMatch && !usedSceneEmojis.has(textMatch)) {
          sceneEmoji = textMatch;
        } else if (textMatch && !sceneEmoji) {
          sceneEmoji = textMatch;
        }
      }

      // 3. Resolve from keyword or visual query
      if (!sceneEmoji) {
        const kwMatch = resolveEmojiForText(`${scene.keyword || ""} ${scene.visualQuery || ""}`);
        if (kwMatch && !usedSceneEmojis.has(kwMatch)) {
          sceneEmoji = kwMatch;
        }
      }

      // 4. If still none or repeated, pick next distinct fallback
      if (!sceneEmoji) {
        const unusedFallback = diverseFallbacks.find((e) => !usedSceneEmojis.has(e));
        sceneEmoji = unusedFallback || diverseFallbacks[sIdx % diverseFallbacks.length];
      }

      usedSceneEmojis.add(sceneEmoji);

      const captions: CaptionSlice[] =
        Array.isArray(scene.captions) && scene.captions.length > 0
          ? scene.captions.map((c) => ({
              ...c,
              emoji: c.emoji || resolveEmojiForText(c.text) || sceneEmoji,
            }))
          : scene.caption || scene.keyword
            ? [
                {
                  text: scene.caption || scene.keyword,
                  start: 0.0,
                  end: duration,
                  emoji: sceneEmoji,
                },
              ]
            : [];

      return {
        ...scene,
        emoji: sceneEmoji,
        graphics,
        captions: captions.length > 0 ? captions : undefined,
      };
    });

    return NextResponse.json({ scenes: finalScenes });
  } catch (error: unknown) {
    console.error("Error analyzing transcript:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
