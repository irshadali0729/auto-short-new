import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";
import { groqJsonCompletion } from "@/app/utils/groq-json";

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

IMPORTANT: Write the "title" and "description" in the SAME language as the transcript above (do not translate them to English). Only the "hashtags" must be in English.

Return ONLY a JSON object with this exact shape:
{
  "title": "a catchy, SEO-optimized YouTube Shorts title, under 100 characters, in the transcript's original language",
  "hashtags": ["#Example1", "#Example2", ...], // 8 to 15 relevant hashtags in English, each starting with #, no spaces
  "description": "a 2-4 paragraph YouTube description in the transcript's original language, naturally including relevant keywords, ending with the same hashtags on their own line"
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

    // Room for the description (2-4 paragraphs, often Devanagari, which is
    // token-heavy) plus gpt-oss's reasoning.
    const responseContent = await groqJsonCompletion(groq, prompt, {
      maxTokens: 4000,
      temperature: 0.4,
      reasoningEffort: "low",
    });

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
