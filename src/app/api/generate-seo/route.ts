import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";
import { withRetry } from "@/app/utils/retry";

function getGroqErrorStatus(err: unknown): number | undefined {
  const asRecord = err as { status?: number; response?: { status?: number } } | null;
  return asRecord?.status ?? asRecord?.response?.status;
}

function buildPrompt(
  transcript: string,
  videoTitle: string,
  channelName: string,
  keywords: string[],
): string {
  const context = [
    videoTitle ? `Source video title: "${videoTitle}"` : "",
    channelName ? `Source channel: "${channelName}"` : "",
    keywords.length ? `Scene keywords: ${keywords.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a YouTube Shorts SEO expert. Based on the transcript below (and any context given), write SEO-optimized upload metadata for this short-form video.

${context}

Transcript:
"""
${transcript.slice(0, 4000)}
"""

Return ONLY a JSON object with this exact shape:
{
  "title": "a catchy, SEO-optimized YouTube Shorts title, under 100 characters",
  "hashtags": ["#Example1", "#Example2", ...], // 8 to 15 relevant hashtags, each starting with #, no spaces
  "description": "a 2-4 paragraph YouTube description summarizing the video, naturally including relevant keywords, ending with the same hashtags on their own line"
}`;
}

export async function POST(request: Request) {
  try {
    const { transcript, videoTitle, channelName, keywords } = await request.json();

    if (!transcript || typeof transcript !== "string" || transcript.trim() === "") {
      return NextResponse.json({ error: "Transcript is required." }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json(
        { error: "GROQ_API_KEY is missing. Add it to .env.local and restart the dev server." },
        { status: 500 },
      );
    }

    const groq = new Groq({ apiKey });

    const prompt = buildPrompt(
      transcript,
      typeof videoTitle === "string" ? videoTitle : "",
      typeof channelName === "string" ? channelName : "",
      Array.isArray(keywords) ? keywords.map(String) : [],
    );

    const candidateModels = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "groq/compound-mini"];

    let responseContent: string | null = null;
    let lastError: Error | null = null;

    for (const model of candidateModels) {
      try {
        const chatCompletion = await withRetry(
          () =>
            groq.chat.completions.create({
              messages: [{ role: "user", content: prompt }],
              model,
              response_format: { type: "json_object" },
              temperature: 0.4,
              max_tokens: 1200,
            }),
          {
            retries: 2,
            baseDelayMs: 1000,
            shouldRetry: (err) => getGroqErrorStatus(err) === 429,
          },
        );

        responseContent = chatCompletion.choices[0]?.message?.content || null;
        if (responseContent) break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`Model ${model} failed, trying next candidate:`, lastError.message);
      }
    }

    if (!responseContent) {
      throw lastError || new Error("Empty response received from Groq API.");
    }

    const parsed = JSON.parse(responseContent);
    const seo = {
      title: String(parsed.title || videoTitle || "Untitled Video").slice(0, 120),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String) : [],
      description: String(parsed.description || ""),
    };

    return NextResponse.json({ seo });
  } catch (error: unknown) {
    console.error("Error generating SEO metadata:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate SEO metadata.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
