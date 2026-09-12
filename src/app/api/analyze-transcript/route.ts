import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";

export interface GraphicBeat {
  prefixText?: string;
  heroWord: string;
  suffixText?: string;
  style?: "stacked-kinetic" | "top-hero" | "thought-bubble" | "breakdown-card";
  text?: string;
  accent?: string;
  type?: "impact" | "money" | "result" | "platform";
  start: number;
  end: number;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
  end: number;
}

export interface CaptionSlice {
  text: string;
  start: number;
  end: number;
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
        sceneCaptions.push({
          text: segments[s].text,
          start: Number(relStart.toFixed(2)),
          end: Number(relEnd.toFixed(2)),
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
  graphics?: GraphicBeat[];
  tags?: string[];
  caption?: string;
  captions?: CaptionSlice[];
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
      return data.scenes;
    }
  } catch (_) {}

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
      return data.scenes;
    }
  } catch (_) {}

  // 5. Regex extraction of valid completed scene objects if truncated
  const sceneObjects: GroqScene[] = [];
  const sceneRegex = /\{\s*"keyword"\s*:\s*"([^"]+)"[\s\S]*?\}(?=\s*[,\]])/g;
  let match;
  while ((match = sceneRegex.exec(cleaned)) !== null) {
    try {
      const sc = JSON.parse(match[0]);
      if (sc.keyword) sceneObjects.push(sc);
    } catch (_) {}
  }
  if (sceneObjects.length > 0) {
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
      return data.scenes;
    }
  } catch (_) {}

  throw new Error("Groq returned invalid or unparseable scene data.");
}

export async function POST(request: Request) {
  try {
    const { transcript, targetLength, segments } = await request.json();

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

    const prompt = `You are creating Islamic YouTube Shorts.
Analyze the transcript.
Extract visual scenes.
Return English keywords, durations, and highly detailed anime-style image generation prompts.

Rules:
* Return valid JSON only without markdown or code fences.
* Do not use unescaped quotes or raw newlines inside string values.
* Return a JSON object with a single key "scenes" which contains an array of objects.
* Each scene object must have:
  - "keyword" (string): Simple visual keyword (max 2 words).
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

Example output:
{
  "scenes": [
    { 
      "keyword": "muslim_husband", 
      "duration": 5, 
      "tags": ["muslim_husband","smile","flower"],
      "caption": "A smiling Muslim husband holding a flower in soft morning light.",
      "graphics": [
        {"prefixText":"I don't have","heroWord":"time.","style":"stacked-kinetic","start":0.4,"end":2.4}
      ],
      "prompt": "An elegant anime style illustration of a smiling Muslim husband holding a flower, soft morning light in the background, vertical 9:16 aspect ratio, soft lighting, highly detailed, 1k" 
    }
  ]
}

Transcript:
${transcript}`;

    const candidateModels = [
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "groq/compound-mini",
    ];

    let responseContent: string | null = null;
    let lastError: Error | null = null;

    for (const model of candidateModels) {
      try {
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          model,
          response_format: { type: "json_object" },
          max_tokens: 3500,
        });

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
      tags: Array.isArray(scene.tags) ? scene.tags : undefined,
      caption: scene.caption ? String(scene.caption) : undefined,
      graphics: Array.isArray(scene.graphics) ? scene.graphics : undefined,
    }));

    if (hasSegments) {
      finalScenes = alignScenesToSegments(finalScenes, segments);
    } else {
      const targetLengthNum = Number(targetLength);
      if (targetLengthNum && !isNaN(targetLengthNum) && targetLengthNum > 0) {
        const currentSum = finalScenes.reduce(
          (acc: number, s: GroqScene) => acc + (Number(s.duration) || 0),
          0,
        );
        if (currentSum > 0) {
          finalScenes = finalScenes.map((s: GroqScene) => ({
            ...s,
            duration: Number(
              (
                (Number(s.duration) || 0) *
                (targetLengthNum / currentSum)
              ).toFixed(2),
            ),
          }));

          const newSum = finalScenes.reduce(
            (acc: number, s: GroqScene) => acc + s.duration,
            0,
          );
          const difference = targetLengthNum - newSum;
          if (Math.abs(difference) > 0.001 && finalScenes.length > 0) {
            finalScenes[finalScenes.length - 1].duration = Number(
              (finalScenes[finalScenes.length - 1].duration + difference).toFixed(
                2,
              ),
            );
          }
        } else {
          const equalDuration = Number(
            (targetLengthNum / finalScenes.length).toFixed(2),
          );
          finalScenes = finalScenes.map((s: GroqScene) => ({
            ...s,
            duration: equalDuration,
          }));

          const newSum = finalScenes.reduce(
            (acc: number, s: GroqScene) => acc + s.duration,
            0,
          );
          const difference = targetLengthNum - newSum;
          if (Math.abs(difference) > 0.001 && finalScenes.length > 0) {
            finalScenes[finalScenes.length - 1].duration = Number(
              (finalScenes[finalScenes.length - 1].duration + difference).toFixed(
                2,
              ),
            );
          }
        }
      }
    }

    finalScenes = finalScenes.map((scene) => {
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

      const captions: CaptionSlice[] =
        Array.isArray(scene.captions) && scene.captions.length > 0
          ? scene.captions
          : scene.caption || scene.keyword
            ? [
                {
                  text: scene.caption || scene.keyword,
                  start: 0.0,
                  end: duration,
                },
              ]
            : [];

      return {
        ...scene,
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
