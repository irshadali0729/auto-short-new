# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**auto-shorts** ("Auto Shorts Maker") is a local Next.js 15 (App Router) tool that turns a transcript (pasted or pulled from a YouTube link) into a compiled vertical (9:16) or widescreen (16:9) short-form video. It analyzes the transcript with an LLM (Groq) to produce a scene breakdown, matches each scene to stock/local media (Pexels, Unsplash, Pixabay, or a local `image-library/`), renders text/graphic/caption/Dua-card overlays as PNGs, then compiles everything with a locally-invoked FFmpeg binary. The content domain is Islamic/spiritual shorts (Hadith/Dua content) — prompts and matching logic are tuned for that (e.g. Dua/Zikr detection, "Muslim" context injection on stock searches).

The UI is styled as an Airbnb-style design system (see `DESIGN.md`) — Tailwind config defines an Airbnb-derived palette (`rausch`, `ink`, `hairline`, etc. in `tailwind.config.ts`).

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint via next lint
```

There is no test suite configured in this repo.

## Required environment variables (`.env.local`)

- `GROQ_API_KEY` — required for `/api/analyze-transcript` (transcript → scenes via Groq's `openai/gpt-oss-120b` with fallback models).
- `TRANSCRIPT_API_KEY` — required for `/api/fetch-transcript` (calls `transcriptapi.com` to pull YouTube captions).
- `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY`, `PIXABAY_API_KEY` — optional stock media providers used by `/api/match-images`. If all are absent, matching falls back to the local `image-library/` and then to a random fallback asset.
- `CLEANUP_ASSETS` — set to `"true"` to force post-generation cleanup of `generated/output.mp4` and downloaded stock assets even outside `NODE_ENV=production`.
- Other keys present in `.env.local` (`CLIPDROP_API_KEY`, `FAL_KEY`, `GEMINI_API_KEY`) are not currently wired into any route — do not assume they're active without checking the relevant `route.ts` first.

FFmpeg itself does not need to be installed system-wide — it's provided by the `@ffmpeg-installer/ffmpeg` npm package and its `.path` is used directly by `spawn()`.

## Pipeline architecture

The app is a single-page client (`src/app/page.tsx`) driving a 4-stage server pipeline, each stage a separate API route. All state (transcript, scenes, media settings) lives in React state on the client and is round-tripped through each API call — there is no database or server-side session.

1. **Fetch transcript** — `POST /api/fetch-transcript` (`src/app/api/fetch-transcript/route.ts`): given a YouTube URL, calls TranscriptAPI and returns raw caption segments. The client de-overlaps YouTube's overlapping on-screen caption timings into real spoken-time segments (each segment's `end` is capped at the next segment's `start`).

2. **Analyze transcript** — `POST /api/analyze-transcript` (`src/app/api/analyze-transcript/route.ts`): sends the transcript (plus timestamped segments, if present) to Groq with a large structured prompt and gets back a `scenes[]` array (keyword, duration, image-search queries, on-screen graphic "beats", captions, and optional `duaInfo` for detected Quranic Dua/Zikr). Two prompt strategies exist, toggled by `useRelatableVisualSearch`:
   - **Relatable visual search** (default): translates spiritual/idiomatic phrases into concrete, photogenic English camera-shot descriptions (`visualQuery`/`fallbackQuery`/`moodQuery`) because Western stock libraries can't search literal Hindi/Urdu spiritual terms.
   - **Legacy**: generates an anime-style image-generation prompt per scene (image generation itself is not wired up in this route — only the prompt is produced).
   
   If real audio segments were supplied, `alignScenesToSegments()` snaps every scene's duration and every graphic/caption timing to the actual spoken timestamps. JSON parsing from the LLM has multiple fallback repair strategies (`extractAndParseScenes`) since models can return truncated/malformed JSON.

3. **Match images** — `POST /api/match-images` (`src/app/api/match-images/route.ts`): for each scene, resolves an actual media asset through a tiered cascade: `visualQuery` → `fallbackQuery` → `moodQuery` → smart-tokenized local library match (with category synonym expansion, e.g. "hijab" ↔ "woman") → random fallback asset. Remote hits from Pexels/Unsplash/Pixabay are downloaded into `image-library/` and cached via `library-cache.ts` (60s in-memory TTL) unless `saveOnlineMediaToDisk` is false. Also injects an AI "video host" presenter: scene 0 can be a full-screen host video hook, and every 4th scene after that becomes a top/bottom (or left/right for 16:9) split-screen of host + stock media, sourced from `image-library/host/<hostType>/` via `host-library.ts`.

4. **Generate video** — `POST /api/generate-video` (`src/app/api/generate-video/route.ts`): kicks off a **fire-and-forget background job** (not awaited in the response) keyed by a client-generated `runId`, tracked in an in-memory `Map` attached to `global` (so progress survives Next.js dev hot-reloads within a single process, but not across server restarts and not across multiple instances). The client polls `GET /api/generate-video/progress?runId=...` every 30s. The background job (`compileVideoInBackground`):
   - Downloads/resolves each scene's image/video/host asset into a temp dir.
   - Renders overlay PNGs per scene via `utils/graphics-renderer.ts` (kinetic text beats), `utils/caption-renderer.ts` (word captions + emoji), or `utils/dua-renderer.ts` (Islamic Dua card), depending on the scene and the selected `textOverlayMode` (`none` | `captions` | `graphics`, mutually exclusive — Dua cards override whichever mode is active for that scene).
   - Builds a per-scene FFmpeg `filter_complex` graph (zoom/pan Ken Burns effect alternating in/out per scene index, boxblur-padded backgrounds for non-matching aspect ratios, split-screen `hstack`/`vstack` for host scenes, PNG overlay compositing with fade in/out, cross-fade transitions) and renders each scene to its own clip via `spawn(ffmpeg, ...)`.
   - Concatenates all clips (`-f concat`) into `generated/output.mp4`, cleans up the temp dir, and marks progress complete.
   - `generated/output.mp4` is streamed back to the client with HTTP range support via `GET /api/video`.

Scene/graphic/caption interfaces (`Scene`, `GraphicBeat`, `CaptionSlice`, `DuaInfo`) are independently redefined in each route file rather than imported from a shared module — when changing a scene field, all of `page.tsx`, `analyze-transcript/route.ts`, `match-images/route.ts`, and `generate-video/route.ts` need to stay in sync.

## Key supporting modules (`src/app/utils/`)

- `media-url.ts` — normalizes any scene `image`/`hostAsset` value (local relative path, remote URL, data/blob URL) into a browser-safe URL, routing local files through `/api/images/[...filename]`.
- `library-cache.ts` — in-memory recursive scan + 60s TTL cache of `image-library/`, used everywhere media needs to be listed or searched instead of hitting the filesystem per request.
- `host-library.ts` — scans `image-library/host/<hostType>/` for presenter video clips used in host-hook and split-screen scenes.
- `emoji-resolver.ts` — maps Hindi/Urdu/English keywords/phrases to a relevant emoji for captions/scene badges, with logic in `analyze-transcript/route.ts` to keep emoji choices distinct across scenes in one video.
- `graphics-renderer.ts`, `caption-renderer.ts`, `dua-renderer.ts` — each renders a transparent overlay PNG (via `@napi-rs/canvas`-style drawing, not FFmpeg `drawtext`) sized to the target aspect ratio, later composited by FFmpeg's `overlay` filter.
- `dua-card-svg.ts` — SVG/theme definitions for the Islamic Dua card overlay (`DuaCardTheme`, e.g. `"cream"`).
- `cleanup.ts` — deletes `generated/output.mp4` and any `pexels_`/`unsplash_`-prefixed downloaded assets; only runs automatically when `NODE_ENV=production` or `CLEANUP_ASSETS=true`, scheduled ~10 min after generation completes (or 3s after a download request).

## Other API routes

- `GET /api/images/[...filename]` — serves files out of `image-library/` by relative path (used by `media-url.ts`'s `getMediaUrl`).
- `GET /api/list-images` — lists all cached library assets for the "Replace Image" picker.
- `GET /api/list-hosts` — lists available host presenter videos per host type.

## Frontend structure

- `src/app/page.tsx` — the entire application UI and orchestration logic (transcript input, storyboard grid, generation progress, video preview) lives in this one large client component. `SettingsModal`, `ReplaceImageModal`, `DuaEditModal`, and `SceneLivePreviewPlayer` (`src/app/components/`) are the only extracted UI pieces.
- Media settings (`MediaSettings`, defined in `SettingsModal.tsx`) are persisted to `localStorage` under the key `hadith_shorts_media_settings` and control: source toggles (Pexels/Unsplash/Pixabay/local), media type preference, relatable-visual-search toggle, aspect ratio, text overlay mode, caption position, emoji captions/style, Dua overlay + theme, video host enable/type, zoom speed, and transition duration — all of these flow straight through to `/api/generate-video`.
- `SceneLivePreviewPlayer` renders an in-browser (non-FFmpeg) approximation of a scene for quick preview before committing to the slow FFmpeg compile step.

## Working in this codebase

- When adding a new scene-level field (e.g. a new overlay type), it must be threaded through: the Groq prompt in `analyze-transcript/route.ts` → the `Scene`/`GroqScene` interfaces in that file → `match-images/route.ts`'s pass-through → `generate-video/route.ts`'s `Scene` interface and FFmpeg filter construction → `page.tsx`'s `Scene` interface and storyboard UI.
- FFmpeg filter graphs are built as raw strings with manual escaping (`escapeFilterText`, comma-escaping in `enable='between(t\,x\,y)'`). Be careful with special characters (`:`, `'`, `,`) in any dynamic text fed into a filter graph — a single unescaped character breaks the whole compile.
- The video generation job is in-memory and per-process (`global.videoProgress`); restarting the dev server mid-generation loses progress tracking for in-flight jobs.
- `DESIGN.md` is the canonical UI style reference (Airbnb-derived design tokens) — check it before making visual/styling changes so new UI stays consistent with the existing Tailwind color/shadow/radius tokens (`rausch`, `ink`, `hairline`, `airbnb` shadow, etc.).
