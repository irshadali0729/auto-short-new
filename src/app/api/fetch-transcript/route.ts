import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { youtubeUrl } = await request.json();

    if (!youtubeUrl || typeof youtubeUrl !== "string") {
      return NextResponse.json(
        { error: "YouTube URL is required." },
        { status: 400 },
      );
    }

    const apiKey = process.env.TRANSCRIPT_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "TRANSCRIPT_API_KEY is missing. Add it to .env.local and restart the dev server.",
        },
        { status: 500 },
      );
    }

    const url = `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${encodeURIComponent(youtubeUrl)}&format=json`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) {
      const detail =
        data?.error ||
        data?.detail ||
        data?.message ||
        `Transcript API request failed (${response.status}).`;
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching transcript:", error);
    return NextResponse.json(
      { error: "Unable to reach the transcript service. Please retry." },
      { status: 502 },
    );
  }
}
