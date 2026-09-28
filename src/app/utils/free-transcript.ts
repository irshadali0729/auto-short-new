import { getVideoDetails } from "youtube-caption-extractor";

// Free, key-less transcript source (reads YouTube's own caption tracks).
// Tried first by /api/fetch-transcript; any failure falls back to TranscriptAPI.

// Preferred caption language. When the video has no track in this language
// the package falls back to the video's first available caption track.
const PREFERRED_LANG = "hi";
const FREE_TRANSCRIPT_TIMEOUT_MS = 10000;

export interface FreeTranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export interface FreeTranscriptResult {
  transcript: FreeTranscriptSegment[];
  videoTitle: string | null;
  channelName: string | null;
}

export function extractYoutubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`);
    const host = parsed.hostname.replace(/^(www\.|m\.)/, "");
    if (host === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }
    if (host.endsWith("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v) return v;
      const match = parsed.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]+)/);
      return match ? match[1] : null;
    }
  } catch {
    // not a URL
  }
  return null;
}

// Channel name via YouTube oEmbed (free, no key). Best-effort only.
async function fetchChannelName(videoId: string, signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      { signal, cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.author_name === "string" ? data.author_name : null;
  } catch {
    return null;
  }
}

/**
 * Returns timed caption segments plus title/channel, or throws when the video
 * has no captions, the lookup fails, or it exceeds the timeout.
 */
export async function fetchFreeTranscript(youtubeUrl: string): Promise<FreeTranscriptResult> {
  const videoId = extractYoutubeVideoId(youtubeUrl);
  if (!videoId) throw new Error("Could not read a video ID from the URL.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FREE_TRANSCRIPT_TIMEOUT_MS);
  // Every request the package makes shares the same deadline.
  const timedFetch: typeof fetch = (input, init) =>
    fetch(input, { ...init, signal: controller.signal });

  try {
    const [details, channelName] = await Promise.all([
      getVideoDetails({ videoID: videoId, lang: PREFERRED_LANG, fetch: timedFetch }),
      fetchChannelName(videoId, controller.signal),
    ]);

    const transcript = (details.subtitles || [])
      .map((s) => ({
        text: (s.text || "").trim(),
        start: Number(s.start) || 0,
        duration: Number(s.dur) || 0,
      }))
      .filter((s) => s.text);

    if (transcript.length === 0) {
      throw new Error("No captions available for this video.");
    }

    const videoTitle =
      details.title && details.title !== "No title found" ? details.title : null;

    return { transcript, videoTitle, channelName };
  } finally {
    clearTimeout(timer);
  }
}
