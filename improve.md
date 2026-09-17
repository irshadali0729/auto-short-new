# Improvement Tracker

Tracks the findings from the codebase audit and their status. See git history for the architecture fixes already applied.

## 1. Architecture — ✅ Complete

- Shared `Scene`/`GraphicBeat`/`CaptionSlice`/`DuaInfo`/`TranscriptSegment` types (`src/app/types/scene.ts`), removing 4 hand-duplicated copies.
- Deduped duration-rescaling logic into `src/app/utils/scene-timing.ts` (`rescaleSceneDurations`), used by `page.tsx` and `analyze-transcript/route.ts`.
- Deduped video-detection regex into the existing `isVideoAsset()` helper (`src/app/utils/media-url.ts`), used everywhere instead of ad hoc regex checks.
- Fixed the O(n²) storyboard re-render (`page.tsx`) with a `useMemo` prefix-sum of scene start times.
- Fixed the generation-progress `setInterval` leaking past unmount (now tracked in a ref and cleared on unmount).

## 2. Reliability — ⬜ Not started

- `global.videoProgress` Map entries are never deleted after a job finishes (memory leak per process lifetime).
- Lost `runId` (e.g. dev server restart) returns `complete:false` with an error the client never surfaces — client polls forever.
- No retry/backoff anywhere: FFmpeg spawn, Groq calls, Pexels/Unsplash/Pixabay calls all fail on first error.
- No way to cancel an in-flight generation job; an abandoned tab leaves FFmpeg running server-side to completion.
- FFmpeg scenes render strictly serially — no bounded parallelism.
- Hardcoded magic numbers with no config: 30s poll interval, 0.0006 zoom step, 1.15 zoom cap, 10-minute cleanup delay, `-threads 2`, Windows-only hardcoded font paths.
- Groq model-fallback list has no exponential backoff and treats 429 the same as any other failure.
- No sanity check on LLM-returned scene durations/counts before they flow downstream (only ad hoc `|| 5` fallbacks).

## 3. Security — ⬜ Not started

- No auth or rate limiting on any API route — unlimited-cost API abuse and FFmpeg-driven DoS risk if ever exposed publicly.
- Raw transcript text is interpolated directly into the Groq prompt with no sanitization or length cap (prompt-injection surface).
- `list-images` exposes the full internal file layout of `image-library/` with no auth.
- Path-traversal guard in `images/[...filename]/route.ts` uses a bare `startsWith()` prefix check without a trailing separator — fragile pattern.
- `generate-video`'s asset resolver `fetch()`s any `http(s)://` URL on a scene with no domain allowlist — currently safe only because scene data always comes from `match-images`.
- API key length (not value) is logged in `analyze-transcript` — unnecessary, low severity.

## 4. Race conditions / correctness bugs — ⬜ Not started

- `cleanup.ts` deletes `pexels_*`/`unsplash_*` files by filename prefix with no per-run locking — a concurrent job's just-downloaded asset can be deleted mid-run by another job's cleanup timer.
- **`cleanupAssets()` never touches `pixabay_*` files** — an actual bug in the existing cleanup feature: Pexels/Unsplash assets get purged, Pixabay assets accumulate forever.
- `library-cache.ts`'s cache is process-local — in any multi-instance deployment, other instances serve stale `list-images` results for up to 60s after an asset is added elsewhere.

## 5. Performance — ⬜ Not started

- `library-cache.ts` does a full recursive `fs.statSync`-per-file scan with no depth limit on cold cache.
- FFmpeg's `-preset superfast -threads 2` are fixed regardless of host machine or scene resolution.

## 6. UX / Accessibility — ⬜ Not started

- None of the 3 modals (`SettingsModal`, `ReplaceImageModal`, `DuaEditModal`) implement a focus trap; `DuaEditModal` doesn't set initial focus on open.
- `DuaEditModal` has no validation — a user can save an empty Dua card silently.
- Broken/expired remote stock images just fade to 30% opacity with no message telling the user to replace them.
- The generation-progress step text ("Check 1 (30s): rendering...") is fabricated copy, not driven by real backend stage/scene progress.
- The "empty" storyboard state doesn't distinguish "not analyzed yet" from "analysis in progress."

## 7. Testing / Tooling — ⬜ Not started

- No test suite at all — no test script, no testing framework in `package.json`.
- No CI configuration (no `.github/workflows`) and no pre-commit enforcement of the existing `lint` script.
- `lucide-react` pinned to `^1.28.0` — unusual for that package (historically 0.x); verify the resolved version isn't a bad range.
- Tailwind pinned at v3.4.1 alongside Next 15/React 19 — a version-skew note for future upgrades.
- No `engines`/`.nvmrc` Node pin, notable given hardcoded Windows-specific font paths baked into the server route.

## 8. Code quality — ⬜ Not started

- Heavy `any` typing in `match-images/route.ts`'s Pexels/Unsplash/Pixabay response-scoring helpers.
- `extractAndParseScenes`'s six sequential JSON-repair fallbacks swallow all errors silently with no logging of which strategy succeeded.
- `buildLegacyPrompt` and `buildRelatableVisualPrompt` copy-paste the entire "Dua/Zikr detection" rule block verbatim.
- `escapeFilterText` doesn't handle `%`/`[`/`]`, which FFmpeg's filter graph syntax also treats specially — risk since this text can originate from uncontrolled LLM output.
- `getFontFileParam()` does synchronous `fs.existsSync` file-probing on every graphics-overlay scene instead of once, cached.
