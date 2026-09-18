// Central place for the magic numbers that used to be hardcoded inline across
// the video generation pipeline, so they can be tuned without hunting through
// FFmpeg filter-graph strings.

export const ZOOM_STEP_BASE = 0.0006;
export const ZOOM_CAP = 1.15;

export const CLEANUP_DELAY_MS = 10 * 60 * 1000;

// How long a finished (complete or errored) job's progress entry is kept in
// memory before being evicted, so long-running dev/prod processes don't leak
// a Map entry per generation forever.
export const PROGRESS_TTL_MS = 15 * 60 * 1000;

// How many scene clips are allowed to render through FFmpeg at the same time.
export const SCENE_RENDER_CONCURRENCY = 2;

export const FFMPEG_THREADS_PER_SCENE = "2";

// Cross-platform search order for a bold sans-serif font usable by FFmpeg's
// drawtext filter. Previously only Windows paths were listed, so overlay text
// silently fell back to the (often missing) generic "Arial" font on Mac/Linux.
export const OVERLAY_FONT_PATHS = [
  "C:/Windows/Fonts/arialbd.ttf",
  "C:/Windows/Fonts/segoeuib.ttf",
  "C:/Windows/Fonts/arial.ttf",
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
];

// A scene clip render or the final concat step gets this many attempts total
// before the job is marked failed (transient file-lock/IO errors on Windows
// are the main thing this protects against — a deterministic filter-graph
// error will simply fail the same way on retry, then give up).
export const FFMPEG_MAX_ATTEMPTS = 2;
export const FFMPEG_RETRY_BASE_DELAY_MS = 1000;
