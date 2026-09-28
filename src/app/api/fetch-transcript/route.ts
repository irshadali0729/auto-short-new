import { NextResponse } from "next/server";
import { fetchFreeTranscript } from "@/app/utils/free-transcript";

export async function POST(request: Request) {
  try {
    const { youtubeUrl } = await request.json();

    if (!youtubeUrl || typeof youtubeUrl !== "string") {
      return NextResponse.json(
        { error: "YouTube URL is required." },
        { status: 400 },
      );
    }

    // 1. Free source first (no key, no quota). Any failure falls through to
    //    the TranscriptAPI path below, which is unchanged.
    try {
      const free = await fetchFreeTranscript(youtubeUrl);
      return NextResponse.json({ ...free, source: "free" });
    } catch (freeErr) {
      console.warn(
        "Free transcript lookup failed, falling back to TranscriptAPI:",
        freeErr instanceof Error ? freeErr.message : freeErr,
      );
    }

    // 2. Fallback: TranscriptAPI (paid).
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
    const metadataUrl = `https://transcriptapi.com/api/v2/youtube/video/metadata?video_url=${encodeURIComponent(youtubeUrl)}`;

    const [response, metadataResponse] = await Promise.all([
      fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      }),
      fetch(metadataUrl, {
        headers: { Authorization: `Bearer ${apiKey}`, accept: "*/*" },
        cache: "no-store",
      }).catch(() => null),
    ]);
    const data = await response.json();

    if (!response.ok) {
      const detail =
        data?.error ||
        data?.detail ||
        data?.message ||
        `Transcript API request failed (${response.status}).`;
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    // The metadata call is best-effort — a failure here shouldn't block the
    // transcript result, since the title/channel are supplementary.
    let videoTitle: string | null = null;
    let channelName: string | null = null;
    if (metadataResponse && metadataResponse.ok) {
      try {
        const metadata = await metadataResponse.json();
        videoTitle = metadata?.title || null;
        channelName = metadata?.channel?.name || null;
      } catch {
        // ignore malformed metadata payload
      }
    }

    return NextResponse.json({ ...data, videoTitle, channelName });
  } catch (error) {
    console.error("Error fetching transcript:", error);
    return NextResponse.json(
      { error: "Unable to reach the transcript service. Please retry." },
      { status: 502 },
    );
  }
}
