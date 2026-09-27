// Client-safe constants (no Node APIs) shared by browser code.

// Progress is a tiny in-memory lookup server-side, so polling often is cheap
// and keeps the progress bar / ETA feeling live.
export const VIDEO_PROGRESS_POLL_INTERVAL_MS = 2500;

// After this many consecutive "job not found" responses, stop polling and
// surface an error instead of polling forever (e.g. the dev server restarted
// mid-generation and the in-memory progress map lost the job). ~10s at 2.5s polls.
export const MAX_NOT_FOUND_POLLS = 4;
