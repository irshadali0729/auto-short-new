// Client-safe constants (no Node APIs) shared by browser code.

export const VIDEO_PROGRESS_POLL_INTERVAL_MS = 30000;

// After this many consecutive "job not found" responses, stop polling and
// surface an error instead of polling forever (e.g. the dev server restarted
// mid-generation and the in-memory progress map lost the job).
export const MAX_NOT_FOUND_POLLS = 2;
