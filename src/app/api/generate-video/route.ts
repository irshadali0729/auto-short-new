import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { cleanupAssets, isCleanupEnabled } from "@/app/utils/cleanup";
import { renderGraphicOverlayPng } from "@/app/utils/graphics-renderer";
import {
  CaptionPosition,
  CaptionTheme,
  renderCaptionOverlayPng,
} from "@/app/utils/caption-renderer";
import { DuaCardTheme, renderDuaOverlayPng } from "@/app/utils/dua-renderer";
import type { DuaCardPosition } from "@/app/types/scene";
import { isVideoAsset } from "@/app/utils/media-url";
import { getCachedLibrary } from "@/app/utils/library-cache";
import { withRetry } from "@/app/utils/retry";
import {
  ZOOM_STEP_BASE,
  ZOOM_CAP,
  CLEANUP_DELAY_MS,
  PROGRESS_TTL_MS,
  SCENE_RENDER_CONCURRENCY,
  FFMPEG_PRESET,
  getFfmpegThreadsPerScene,
  OVERLAY_FONT_PATHS,
  FFMPEG_MAX_ATTEMPTS,
  FFMPEG_RETRY_BASE_DELAY_MS,
} from "@/app/config/video-config";
import type { Scene, GraphicBeat, GraphicMotionThemeOption } from "@/app/types/scene";
import { buildSavedVideoFilename } from "@/app/utils/filename";
import { ctaInputArgs, loadCtaLibrary, resolveCtaFile } from "@/app/utils/cta-library";
import {
  CTA_VARIANT_AUTO,
  CTA_Y_FRACTION,
  ctaMaxBox,
  planCtaPlacements,
  type CtaOptions,
  type CtaPosition,
} from "@/app/utils/cta-shared";
import {
  VIDEO_BG_BOXBLUR,
  blurBackgroundSize,
  cropOverlayToContent,
  prepareStillComposite,
  prepareStillCover,
} from "@/app/utils/optimized-render";

const ffmpegPath = ffmpegInstaller.path;

export type GenerationStage =
  | "preparing"
  | "rendering_scenes"
  | "merging"
  | "done";

interface ProgressData {
  complete: boolean;
  error: string | null;
  videoPath: string | null;
  stage?: GenerationStage;
  scenesCompleted?: number;
  totalScenes?: number;
  savedFilename?: string;
  /** 1-based scene numbers whose missing image was replaced. */
  substitutedScenes?: number[];
}

export interface JobControl {
  processes: Set<ChildProcess>;
  tempDir: string;
  cancelled: boolean;
}

interface CustomGlobal {
  videoProgress?: Map<string, ProgressData>;
  videoJobControl?: Map<string, JobControl>;
}

const customGlobal = global as unknown as CustomGlobal;
if (!customGlobal.videoProgress) {
  customGlobal.videoProgress = new Map();
}
if (!customGlobal.videoJobControl) {
  customGlobal.videoJobControl = new Map();
}
const progressMap = customGlobal.videoProgress;
const jobControlMap = customGlobal.videoJobControl;

// Marks a job finished and schedules the eviction of its progress/control
// entries so the in-memory maps don't grow forever across a long-lived
// server process (each generation used to leak a Map entry permanently).
function finishJob(runId: string, data: ProgressData) {
  progressMap.set(runId, data);
  setTimeout(() => {
    progressMap.delete(runId);
    jobControlMap.delete(runId);
  }, PROGRESS_TTL_MS);
}

// Removes every generated/temp_run_* folder not owned by a still-running job.
// Catches leftovers the per-job cleanup missed (server restarted mid-run, or
// Windows file locks making the earlier rmSync fail).
function sweepStaleTempDirs(generatedDir: string) {
  const activeTempDirs = new Set<string>();
  for (const [id, control] of jobControlMap) {
    // A finished job can still have FFmpeg processes shutting down.
    const stillRunning = progressMap.get(id)?.complete === false || control.processes.size > 0;
    if (control.tempDir && stillRunning) {
      activeTempDirs.add(path.resolve(control.tempDir));
    }
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(generatedDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("temp_run_")) continue;
    const dirPath = path.resolve(generatedDir, entry.name);
    if (activeTempDirs.has(dirPath)) continue;
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (err) {
      // Windows keeps a file locked briefly after the process using it exits;
      // the next generation's sweep will get it, so no need for a stack trace.
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EBUSY" && code !== "EPERM") {
        console.warn(`Failed to delete stale temp folder ${entry.name}:`, err);
      }
    }
  }
}

// Stops a failed job's remaining FFmpeg processes (other scenes render
// concurrently and keep going after one fails) and waits for them to exit,
// so its temp folder isn't deleted while FFmpeg still has files open.
async function stopJobProcesses(control: JobControl, timeoutMs = 5000): Promise<void> {
  control.cancelled = true;
  for (const proc of control.processes) {
    try {
      proc.kill("SIGTERM");
    } catch {}
  }
  const deadline = Date.now() + timeoutMs;
  while (control.processes.size > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// Merges a stage/scene-count update into the job's progress entry instead of
// replacing it, so the client can show real backend state ("Scene 3/8
// rendering") instead of the old fabricated "Check N (30s): ..." copy that
// wasn't actually driven by what the server was doing.
function updateProgress(runId: string, partial: Partial<ProgressData>) {
  const current = progressMap.get(runId) || {
    complete: false,
    error: null,
    videoPath: null,
  };
  progressMap.set(runId, { ...current, ...partial });
}

const CANCELLED_ERROR_MESSAGE = "Video generation cancelled.";

type CtaSettings = CtaOptions & { enabled: boolean; position: CtaPosition };

function escapeFilterText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    // '%' triggers drawtext's text-expansion syntax (e.g. %{expr:...}) and
    // '[' / ']' are filtergraph link-label delimiters — this text can
    // originate from uncontrolled LLM output, so all three need escaping
    // the same way ':' already was, not just quotes/backslashes.
    .replace(/%/g, "\\%")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\n/g, "\\\n");
}

function buildDefaultGraphicBeats(duration: number): GraphicBeat[] {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 6;
  const startA = Math.min(
    Math.max(safeDuration * 0.15, 0.4),
    Math.max(0.4, safeDuration - 2.8),
  );
  const startB = Math.min(
    Math.max(startA + 2.2, safeDuration * 0.55),
    Math.max(startA + 2.2, safeDuration - 1.6),
  );

  return [
    {
      prefixText: "I DON'T HAVE",
      heroWord: "TIME.",
      style: "stacked-kinetic",
      start: startA,
      end: Math.min(safeDuration, startA + 2.0),
    },
    {
      heroWord: "EXCUSE",
      prefixText: "NOT TO PRAY?",
      style: "top-hero",
      start: startB,
      end: Math.min(safeDuration, startB + 1.8),
    },
  ];
}

// The font path list never changes at runtime, so the fs.existsSync() probe
// only needs to run once per process instead of once per graphics-overlay
// scene (a video with 10 scenes was doing this filesystem probe 10x over).
let cachedFontFileParam: string | null = null;

function getFontFileParam(): string {
  if (cachedFontFileParam !== null) return cachedFontFileParam;

  for (const p of OVERLAY_FONT_PATHS) {
    if (fs.existsSync(p)) {
      const escaped = p.replace(/\\/g, "/").replace(/:/g, "\\:");
      cachedFontFileParam = `fontfile='${escaped}'`;
      return cachedFontFileParam;
    }
  }
  cachedFontFileParam = "font='Arial'";
  return cachedFontFileParam;
}

function buildGraphicsFilter(scene: Scene): { filterChain: string; lastLabel: string } {
  const duration = Number(scene.duration) || 6;
  const beats =
    Array.isArray(scene.graphics) && scene.graphics.length > 0
      ? scene.graphics
      : buildDefaultGraphicBeats(duration);

  if (!beats.length) {
    return { filterChain: "", lastLabel: "grid" };
  }

  const fontParam = getFontFileParam();
  let currentLabel = "grid";
  let filterChain = "";

  beats.forEach((beat, index) => {
    const start = Math.min(Math.max(Number(beat.start) || 0, 0), duration);
    const end = Math.min(
      Math.max(Number(beat.end) || start + 1.5, start + 0.8),
      duration,
    );
    const textValue = (beat.text || "BUILD").trim().toUpperCase();
    const accentValue = (beat.accent || textValue || "TRUST")
      .trim()
      .toUpperCase();
    const primaryText = escapeFilterText(textValue);
    const accentText = escapeFilterText(accentValue);
    const type = beat.type || "impact";
    const baseY = 180 + index * 120;
    const accentX = type === "money" ? 450 : 420;
    const accentY = type === "money" ? baseY + 8 : baseY + 36;
    const iconText = type === "platform" ? "IG" : type === "money" ? "$" : ">";
    const iconX = type === "money" ? 820 : 900;
    const iconY = type === "money" ? baseY + 10 : baseY + 18;
    const primaryLabel = `text_${index}`;
    const accentLabel = `accent_${index}`;
    const iconLabel = `icon_${index}`;

    filterChain += `[${currentLabel}]drawtext=text='${primaryText}':fontcolor=white:${fontParam}:fontsize=${type === "money" ? 120 : 92}:x=120:y=${baseY}:shadowcolor=black@0.5:shadowx=2:shadowy=2:enable='between(t,${start},${end})'[${primaryLabel}];`;
    filterChain += `[${primaryLabel}]drawtext=text='${accentText}':fontcolor=0xFACC15:${fontParam}:fontsize=${type === "money" ? 136 : 108}:x=${accentX}:y=${accentY}:shadowcolor=black@0.55:shadowx=2:shadowy=2:enable='between(t,${start},${end})'[${accentLabel}];`;
    filterChain += `[${accentLabel}]drawtext=text='${iconText}':fontcolor=white:${fontParam}:fontsize=46:x=${iconX}:y=${iconY}:shadowcolor=black@0.4:shadowx=2:shadowy=2:enable='between(t,${start},${end})'[${iconLabel}];`;
    currentLabel = iconLabel;
  });

  return { filterChain, lastLabel: currentLabel };
}

export async function POST(request: Request) {
  try {
    const {
      scenes,
      runId,
      videoTitle,
      channelName,
      zoomSpeed,
      transitionDuration,
      textOverlayMode,
      captionPosition,
      captionTheme,
      enableGraphicMotion,
      enableCaptions,
      aspectRatio,
      enableEmojiCaptions,
      emojiStyle,
      enableDuaOverlay,
      duaCardTheme,
      duaCardPosition,
      graphicMotionTheme,
      optimizedGeneration,
      enableCtaOverlays,
      ctaVariant,
      ctaPosition,
      ctaAtEnd,
      ctaOnTriggers,
    } = await request.json();

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { error: "Scenes list is required to generate the video." },
        { status: 400 },
      );
    }

    if (!runId) {
      return NextResponse.json(
        { error: "runId is required for status tracking." },
        { status: 400 },
      );
    }

    const zoomSpeedMultiplier = typeof zoomSpeed === "number" ? zoomSpeed : 1.0;
    const transitionDurationSec =
      typeof transitionDuration === "number" ? transitionDuration : 0.3;
    const targetRatio: "9:16" | "16:9" = aspectRatio === "16:9" ? "16:9" : "9:16";
    const resolvedCaptionPosition: CaptionPosition =
      captionPosition === "top" || captionPosition === "middle" || captionPosition === "bottom"
        ? captionPosition
        : "bottom";
    const resolvedCaptionTheme: CaptionTheme =
      captionTheme === "bold_outline" ||
      captionTheme === "gradient_highlight" ||
      captionTheme === "pill_translucent"
        ? captionTheme
        : "pill";

    // Mutually exclusive text overlay mode
    const resolvedMode: "none" | "captions" | "graphics" =
      textOverlayMode === "captions" || textOverlayMode === "graphics" || textOverlayMode === "none"
        ? textOverlayMode
        : enableGraphicMotion && !enableCaptions
          ? "graphics"
          : enableCaptions && !enableGraphicMotion
            ? "captions"
            : "none";

    progressMap.set(runId, {
      complete: false,
      error: null,
      videoPath: null,
      stage: "preparing",
      scenesCompleted: 0,
      totalScenes: scenes.length,
    });
    jobControlMap.set(runId, {
      processes: new Set(),
      tempDir: "",
      cancelled: false,
    });

    compileVideoInBackground(
      runId,
      scenes,
      zoomSpeedMultiplier,
      transitionDurationSec,
      resolvedMode,
      targetRatio,
      enableEmojiCaptions !== false,
      emojiStyle || "fluent",
      enableDuaOverlay !== false,
      duaCardTheme || "cream",
      resolvedCaptionPosition,
      graphicMotionTheme || "auto",
      resolvedCaptionTheme,
      typeof videoTitle === "string" ? videoTitle : "",
      typeof channelName === "string" ? channelName : "",
      duaCardPosition === "top" || duaCardPosition === "bottom" ? duaCardPosition : "center",
      optimizedGeneration === true,
      {
        enabled: enableCtaOverlays !== false,
        variant: typeof ctaVariant === "string" && ctaVariant ? ctaVariant : CTA_VARIANT_AUTO,
        position: ctaPosition === "top" || ctaPosition === "middle" ? ctaPosition : "bottom",
        atEnd: ctaAtEnd !== false,
        onTriggers: ctaOnTriggers !== false,
      },
    ).catch((err) => {
      console.error("Background compilation crash:", err);
      finishJob(runId, {
        complete: true,
        error: err.message || "Background compilation failed.",
        videoPath: null,
      });
    });

    return NextResponse.json({ runId });
  } catch (error: unknown) {
    console.error("Error starting video generation:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

async function compileVideoInBackground(
  runId: string,
  scenes: Scene[],
  zoomSpeedMultiplier: number,
  transitionDuration: number,
  textOverlayMode: "none" | "captions" | "graphics" = "captions",
  targetRatio: "9:16" | "16:9" = "9:16",
  enableEmojiCaptions: boolean = true,
  emojiStyle: "fluent" | "apple" | "twitter" = "fluent",
  enableDuaOverlay: boolean = true,
  duaCardTheme: DuaCardTheme = "cream",
  captionPosition: CaptionPosition = "bottom",
  graphicMotionTheme: GraphicMotionThemeOption = "auto",
  captionTheme: CaptionTheme = "pill",
  videoTitle: string = "",
  channelName: string = "",
  duaCardPosition: DuaCardPosition = "center",
  // Opt-in fast path (see utils/optimized-render.ts); false keeps the
  // original filter graphs untouched.
  optimized: boolean = false,
  // Subscribe/share/bell animations (see utils/cta-shared.ts).
  cta: CtaSettings = { enabled: false, variant: CTA_VARIANT_AUTO, position: "bottom", atEnd: false, onTriggers: false },
) {
  let tempDir = "";
  const jobControl: JobControl = jobControlMap.get(runId) || {
    processes: new Set(),
    tempDir: "",
    cancelled: false,
  };
  jobControlMap.set(runId, jobControl);
  updateProgress(runId, { stage: "preparing", scenesCompleted: 0, totalScenes: scenes.length });

  try {
    const projectRoot = process.cwd();
    const imageLibraryDir = path.join(projectRoot, "image-library");
    const generatedDir = path.join(projectRoot, "generated");

    const targetWidth = targetRatio === "16:9" ? 1920 : 1080;
    const targetHeight = targetRatio === "16:9" ? 1080 : 1920;

    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    const tempRunId = Date.now();
    tempDir = path.join(generatedDir, `temp_run_${tempRunId}`);
    fs.mkdirSync(tempDir, { recursive: true });
    jobControl.tempDir = tempDir;

    const adjustedScenes = scenes.map((scene) => ({
      ...scene,
      duration: Number(Number(scene.duration || 5).toFixed(2)),
      graphics:
        Array.isArray(scene.graphics) && scene.graphics.length > 0
          ? scene.graphics
          : buildDefaultGraphicBeats(Number(scene.duration) || 5),
    }));

    const clipPaths: string[] = new Array(adjustedScenes.length);

    // Planned up front (scenes render concurrently) so variants rotate in order.
    const ctaPlan = cta.enabled
      ? planCtaPlacements(adjustedScenes, await loadCtaLibrary(), cta)
      : adjustedScenes.map(() => null);

async function resolveSceneAsset(
  assetPathOrUrl: string,
  imageLibraryDir: string,
  tempDir: string,
  tempPrefix: string,
): Promise<string> {
  if (!assetPathOrUrl) return "";

  if (assetPathOrUrl.startsWith("http://") || assetPathOrUrl.startsWith("https://")) {
    const ext = isVideoAsset(assetPathOrUrl) ? ".mp4" : ".jpg";
    const tempFilePath = path.join(tempDir, `${tempPrefix}${ext}`);

    console.log(`[generate-video] Downloading temporary remote asset for compile: ${assetPathOrUrl}`);
    const res = await fetch(assetPathOrUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch remote asset: ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(tempFilePath, buffer);
    return tempFilePath;
  }

  const localPath = path.join(imageLibraryDir, assetPathOrUrl);
  if (!fs.existsSync(localPath)) {
    throw new Error(`Image asset "${assetPathOrUrl}" not found in image library.`);
  }
  return localPath;
}

    // A storyboard can outlive its files (cleanup deletes downloaded stock
    // media; a draft restored days later points at deleted files). Instead of
    // failing the whole render, swap a missing scene image for another library
    // asset of the same kind and report which scenes changed.
    const substitutedScenes: number[] = [];
    let libraryPool: string[] | null = null;
    async function resolveSceneAssetOrSubstitute(sceneIndex: number, asset: string): Promise<string> {
      const isRemote = /^https?:\/\//i.test(asset);
      if (!asset || fs.existsSync(path.join(imageLibraryDir, asset))) {
        return resolveSceneAsset(asset, imageLibraryDir, tempDir, `remote_scene_${sceneIndex}`);
      }
      if (isRemote) {
        // A remote URL (online media not saved to disk) can expire or be unreachable.
        try {
          return await resolveSceneAsset(asset, imageLibraryDir, tempDir, `remote_scene_${sceneIndex}`);
        } catch (err) {
          console.warn(`[generate-video] Scene ${sceneIndex + 1}: remote asset failed (${err instanceof Error ? err.message : err}).`);
        }
      }
      if (!libraryPool) {
        libraryPool = (await getCachedLibrary(true))
          .map((item) => item.relativePath)
          .filter((p) => !/^(avatars|cta)\//.test(p));
      }
      const wantVideo = isVideoAsset(asset);
      const sameKind = libraryPool.filter((p) => isVideoAsset(p) === wantVideo);
      const pool = sameKind.length > 0 ? sameKind : libraryPool;
      if (pool.length === 0) {
        throw new Error(`Image asset "${asset}" not found and the image library is empty.`);
      }
      const replacement = pool[Math.floor(Math.random() * pool.length)];
      console.warn(`[generate-video] Scene ${sceneIndex + 1}: "${asset}" is missing; using "${replacement}" instead.`);
      substitutedScenes.push(sceneIndex + 1);
      return path.join(imageLibraryDir, replacement);
    }

    async function renderSceneClip(i: number): Promise<void> {
      if (jobControl.cancelled) throw new Error(CANCELLED_ERROR_MESSAGE);

      const scene = adjustedScenes[i];
      const imageFilename = scene.image;
      const duration = scene.duration;

      const inputImagePath = await resolveSceneAssetOrSubstitute(i, imageFilename);

      const clipOutputPath = path.join(tempDir, `clip_${i}.mp4`);
      clipPaths[i] = clipOutputPath;

      const isZoomIn = i % 2 === 0;
      const speedStep = ZOOM_STEP_BASE * zoomSpeedMultiplier;
      const zoomExpression = isZoomIn
        ? `min(1.0+on*${speedStep},${ZOOM_CAP})`
        : `max(${ZOOM_CAP}-on*${speedStep},1.0)`;

      const sceneFade = Math.min(transitionDuration, duration / 2);

      const beats =
        Array.isArray(scene.graphics) && scene.graphics.length > 0
          ? scene.graphics
          : buildDefaultGraphicBeats(duration);

      // x/y are only set on the optimized path (overlay cropped to content).
      type OverlayPng = { path: string; start: number; end: number; x?: number; y?: number };
      const overlayPngList: OverlayPng[] = [];
      const captionPngList: OverlayPng[] = [];

      const isDuaScene =
        enableDuaOverlay &&
        scene.duaInfo &&
        typeof scene.duaInfo === "object" &&
        scene.duaInfo.isDua &&
        Boolean(scene.duaInfo.hindi || scene.duaInfo.arabic);

      if (isDuaScene) {
        const duaOverlayPath = path.join(tempDir, `dua_card_${i}.png`);
        try {
          await renderDuaOverlayPng(
            // A position set per scene in the Dua editor beats the global default.
            { ...scene.duaInfo!, position: scene.duaInfo?.position || duaCardPosition },
            duaOverlayPath,
            targetWidth,
            targetHeight,
            scene.duaInfo?.theme || duaCardTheme,
          );
          if (fs.existsSync(duaOverlayPath)) {
            captionPngList.push({
              path: duaOverlayPath,
              start: 0,
              end: duration,
            });
          }
        } catch (duaErr) {
          console.warn(`Failed to render dua overlay for scene ${i}:`, duaErr);
        }
      } else if (textOverlayMode === "captions") {
        const sceneCaptions =
          Array.isArray(scene.captions) && scene.captions.length > 0
            ? scene.captions
            : [];

        for (let c = 0; c < sceneCaptions.length; c++) {
          const cap = sceneCaptions[c];
          const capText = (cap.text || "").trim();
          if (!capText) continue;

          const overlayPath = path.join(tempDir, `caption_${i}_${c}.png`);
          const sliceEmoji = enableEmojiCaptions
            ? cap.emoji || scene.emoji
            : undefined;
          try {
            await renderCaptionOverlayPng(
              capText,
              overlayPath,
              targetWidth,
              targetHeight,
              sliceEmoji,
              emojiStyle,
              captionPosition,
              captionTheme,
            );
            if (fs.existsSync(overlayPath)) {
              captionPngList.push({
                path: overlayPath,
                start: Math.max(0, Number(cap.start) || 0),
                end: Math.min(
                  duration,
                  Math.max((Number(cap.start) || 0) + 0.5, Number(cap.end) || duration),
                ),
              });
            }
          } catch (capErr) {
            console.warn(`Failed to render caption overlay ${i}_${c}:`, capErr);
          }
        }
      } else if (textOverlayMode === "graphics") {
        for (let b = 0; b < beats.length; b++) {
          const beat = beats[b];
          const overlayPath = path.join(tempDir, `overlay_${i}_${b}.png`);
          const themedBeat =
            graphicMotionTheme !== "auto"
              ? { ...beat, style: graphicMotionTheme }
              : beat;
          try {
            await renderGraphicOverlayPng(themedBeat, overlayPath, targetWidth, targetHeight);
            if (fs.existsSync(overlayPath)) {
              overlayPngList.push({
                path: overlayPath,
                start: Math.max(0, Number(beat.start) || 0),
                end: Math.min(
                  duration,
                  Math.max((Number(beat.start) || 0) + 0.8, Number(beat.end) || duration),
                ),
              });
            }
          } catch (overlayErr) {
            console.warn(`Failed to render graphic overlay ${i}_${b}:`, overlayErr);
          }
        }
      }

      const sceneImageIsVideo = isVideoAsset(imageFilename);

      const isSplitScreenScene = Boolean(scene.isSplitScreen && scene.avatarAsset);
      const avatarFilename = scene.avatarAsset || "";
      // A missing avatar clip falls back to a normal full-screen scene.
      const inputAvatarPath = isSplitScreenScene
        ? await resolveSceneAsset(avatarFilename, imageLibraryDir, tempDir, `remote_avatar_${i}`).catch((err) => {
            console.warn(`[generate-video] Scene ${i + 1}: avatar unavailable, rendering full-screen:`, err instanceof Error ? err.message : err);
            return "";
          })
        : "";
      const hasValidAvatarFile = isSplitScreenScene && Boolean(inputAvatarPath && fs.existsSync(inputAvatarPath));

      // Optimized path: bake the static still into one pre-sized frame so
      // zoompan is the only per-frame work, and crop overlay PNGs to their
      // visible pixels. Any prep failure falls back to the legacy graph.
      const frameCount = Math.ceil(duration * 30) + 2;
      const videoFps = optimized ? "fps=30," : "";
      let preparedStillPath = "";
      if (optimized && !sceneImageIsVideo && inputImagePath) {
        const preparedPath = path.join(tempDir, `still_${i}.jpg`);
        try {
          if (hasValidAvatarFile) {
            const [w, h] =
              targetRatio === "16:9"
                ? [Math.floor(targetWidth / 2), targetHeight]
                : [targetWidth, Math.floor(targetHeight / 2)];
            await prepareStillCover(inputImagePath, preparedPath, w, h);
          } else {
            await prepareStillComposite(inputImagePath, preparedPath, targetWidth, targetHeight);
          }
          preparedStillPath = preparedPath;
        } catch (prepErr) {
          console.warn(`Optimized still prep failed for scene ${i}, using legacy graph:`, prepErr);
        }
      }
      if (optimized) {
        for (const list of [captionPngList, overlayPngList]) {
          const cropped = await Promise.all(
            list.map(async (ov): Promise<OverlayPng | null> => {
              try {
                const c = await cropOverlayToContent(ov.path, ov.path.replace(/\.png$/, "_crop.png"));
                return c ? { ...ov, path: c.path, x: c.x, y: c.y } : null;
              } catch (cropErr) {
                console.warn(`Overlay crop failed for ${ov.path}, using full frame:`, cropErr);
                return ov;
              }
            }),
          );
          list.splice(0, list.length, ...cropped.filter((ov): ov is OverlayPng => ov !== null));
        }
      }


      let filterGraph = "";
      let overlayBaseInputIdx = 1;

      if (hasValidAvatarFile) {
        overlayBaseInputIdx = 2; // Input 0: Avatar Video, Input 1: Stock Media
        const isStockVideo = isVideoAsset(imageFilename);

        if (targetRatio === "16:9") {
          // Landscape: Left/Right 50/50 Split
          const halfWidth = Math.floor(targetWidth / 2);
          const dividerX = halfWidth - 2;

          let stockChain = "";
          if (isStockVideo) {
            stockChain = `[1:v]${videoFps}scale=${halfWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${halfWidth}:${targetHeight},setpts=PTS-STARTPTS[right];`;
          } else if (preparedStillPath) {
            stockChain = `[1:v]zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2':d=${frameCount}:s=${halfWidth}x${targetHeight}:fps=30[right];`;
          } else {
            stockChain =
              `[1:v]scale=${halfWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${halfWidth}:${targetHeight}[r_still];` +
              `[r_still]zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2':d=1:s=${halfWidth}x${targetHeight}:fps=30[right];`;
          }

          filterGraph =
            `[0:v]${videoFps}scale=${halfWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${halfWidth}:${targetHeight},setpts=PTS-STARTPTS[left];` +
            stockChain +
            `[left][right]hstack=inputs=2[split_raw];` +
            `[split_raw]drawbox=x=${dividerX}:y=0:w=4:h=${targetHeight}:color=white@0.35:t=fill[zoomed];` +
            `[zoomed]drawgrid=width=100:height=100:thickness=1:color=white@0.04[grid];`;
        } else {
          // Vertical (9:16): Top/Bottom 50/50 Split
          const halfHeight = Math.floor(targetHeight / 2);
          const dividerY = halfHeight - 2;

          let stockChain = "";
          if (isStockVideo) {
            stockChain = `[1:v]${videoFps}scale=${targetWidth}:${halfHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${halfHeight},setpts=PTS-STARTPTS[bottom];`;
          } else if (preparedStillPath) {
            stockChain = `[1:v]zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2':d=${frameCount}:s=${targetWidth}x${halfHeight}:fps=30[bottom];`;
          } else {
            stockChain =
              `[1:v]scale=${targetWidth}:${halfHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${halfHeight}[b_still];` +
              `[b_still]zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2':d=1:s=${targetWidth}x${halfHeight}:fps=30[bottom];`;
          }

          // Bias the crop window toward the top of the source frame (instead of
          // dead-centering it) so the avatar's head isn't clipped when a tall
          // 9:16 clip gets squeezed into this short half-height split panel.
          filterGraph =
            `[0:v]${videoFps}scale=${targetWidth}:${halfHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${halfHeight}:(in_w-out_w)/2:(in_h-out_h)*0.25,setpts=PTS-STARTPTS[top];` +
            stockChain +
            `[top][bottom]vstack=inputs=2[split_raw];` +
            `[split_raw]drawbox=x=0:y=${dividerY}:w=${targetWidth}:h=4:color=white@0.35:t=fill[zoomed];` +
            `[zoomed]drawgrid=width=100:height=100:thickness=1:color=white@0.04[grid];`;
        }
      } else if (sceneImageIsVideo && optimized) {
        // Background blur at 1/4 resolution, input capped to 30fps before filtering.
        const bgSize = blurBackgroundSize(targetWidth, targetHeight);
        filterGraph =
          `[0:v]fps=30,split=2[src_bg][src_fg];` +
          `[src_bg]scale=${bgSize.w}:${bgSize.h}:force_original_aspect_ratio=increase,crop=${bgSize.w}:${bgSize.h},${VIDEO_BG_BOXBLUR},scale=${targetWidth}:${targetHeight},setpts=PTS-STARTPTS[bg];` +
          `[src_fg]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,setpts=PTS-STARTPTS[fg_scaled];` +
          `[bg][fg_scaled]overlay=(W-w)/2:(H-h)/2[zoomed];` +
          `[zoomed]drawgrid=width=100:height=100:thickness=1:color=white@0.04[grid];`;
      } else if (sceneImageIsVideo) {
        filterGraph =
          `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},boxblur=20:5,setpts=PTS-STARTPTS[bg];` +
          `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,setpts=PTS-STARTPTS[fg_scaled];` +
          `[bg][fg_scaled]overlay=(W-w)/2:(H-h)/2[zoomed];` +
          `[zoomed]drawgrid=width=100:height=100:thickness=1:color=white@0.04[grid];`;
      } else if (preparedStillPath) {
        // Composite already baked by sharp; zoompan emits every frame from one decoded image.
        filterGraph =
          `[0:v]zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2':d=${frameCount}:s=${targetWidth}x${targetHeight}:fps=30[zoomed];` +
          `[zoomed]drawgrid=width=100:height=100:thickness=1:color=white@0.04[grid];`;
      } else {
        filterGraph =
          `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},boxblur=20:5[bg];` +
          `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease[fg_scaled];` +
          `[bg][fg_scaled]overlay=(W-w)/2:(H-h)/2[merged];` +
          `[merged]zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2':d=1:s=${targetWidth}x${targetHeight}:fps=30[zoomed];` +
          `[zoomed]drawgrid=width=100:height=100:thickness=1:color=white@0.04[grid];`;
      }

      let currentLabel = "grid";

      // A Dua card lives in captionPngList and overrides every text mode —
      // previously it was only drawn in "captions" mode, so graphics mode fell
      // through to drawtext (no Devanagari glyphs → boxes) and "none" dropped it.
      const useCaptionLayer =
        captionPngList.length > 0 && (textOverlayMode === "captions" || Boolean(isDuaScene));
      const activePngList = useCaptionLayer
        ? captionPngList
        : textOverlayMode === "graphics"
          ? overlayPngList
          : [];
      const activeOverlayCount = activePngList.length;

      // Mutually exclusive overlay composition into FFmpeg filter graph
      if (useCaptionLayer) {
        captionPngList.forEach((ov, idx) => {
          const inputIdx = overlayBaseInputIdx + idx;
          const nextLabel = `v_cap_${idx}`;
          const fadedLabel = `faded_cap_${idx}`;
          const st = ov.start.toFixed(2);
          const et = ov.end.toFixed(2);
          const capDur = Math.max(0.1, ov.end - ov.start);
          const fadeIn = Math.min(0.15, capDur / 4).toFixed(2);
          const fadeOut = Math.min(0.15, capDur / 4).toFixed(2);
          const fadeOutStart = Math.max(ov.start, ov.end - Number(fadeOut)).toFixed(2);

          // Optimized inputs only run for the overlay's own window, so shift
          // them to start at st; eof_action=pass keeps the scene going after.
          const srcShift = optimized ? `setpts=PTS-STARTPTS+${st}/TB,` : "";
          const placement = optimized ? `x=${ov.x ?? 0}:y=${ov.y ?? 0}:eof_action=pass` : "x=0:y=0";
          filterGraph += `[${inputIdx}:v]${srcShift}format=rgba,fade=t=in:st=${st}:d=${fadeIn}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${fadeOut}:alpha=1[${fadedLabel}];`;
          filterGraph += `[${currentLabel}][${fadedLabel}]overlay=${placement}:enable='between(t\\,${st}\\,${et})'[${nextLabel}];`;
          currentLabel = nextLabel;
        });
      } else if (textOverlayMode === "graphics") {
        if (overlayPngList.length > 0) {
          overlayPngList.forEach((ov, idx) => {
            const inputIdx = overlayBaseInputIdx + idx;
            const nextLabel = `v_ov_${idx}`;
            const fadedLabel = `faded_ov_${idx}`;
            const st = ov.start.toFixed(2);
            const et = ov.end.toFixed(2);
            const beatDuration = Math.max(0.1, ov.end - ov.start);
            const fadeInDur = Math.min(0.25, beatDuration / 3).toFixed(2);
            const fadeOutDur = Math.min(0.2, beatDuration / 3).toFixed(2);
            const fadeOutStart = Math.max(
              ov.start,
              ov.end - Number(fadeOutDur),
            ).toFixed(2);

            // Smooth alpha fade-in and fade-out applied directly to the RGBA overlay stream
            const srcShift = optimized ? `setpts=PTS-STARTPTS+${st}/TB,` : "";
            filterGraph += `[${inputIdx}:v]${srcShift}format=rgba,fade=t=in:st=${st}:d=${fadeInDur}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${fadeOutDur}:alpha=1[${fadedLabel}];`;

            // Kinetic slide-up 35px into rest position, evaluated per frame with escaped commas
            const yBase = optimized ? `${ov.y ?? 0}+` : "";
            const yExpr = `'${yBase}if(lt(t\\,${st})\\,35\\,if(lt(t\\,${st}+0.25)\\,35*(1-(t-${st})/0.25)\\,0))'`;
            const xPos = optimized ? `${ov.x ?? 0}` : "0";
            const eofPass = optimized ? ":eof_action=pass" : "";
            filterGraph += `[${currentLabel}][${fadedLabel}]overlay=x=${xPos}:y=${yExpr}:eval=frame${eofPass}:enable='between(t\\,${st}\\,${et})'[${nextLabel}];`;
            currentLabel = nextLabel;
          });
        } else {
          const { filterChain: graphicsChain, lastLabel: drawTextLabel } =
            buildGraphicsFilter(scene);
          if (graphicsChain) {
            filterGraph += graphicsChain;
            currentLabel = drawTextLabel;
          }
        }
      }

      const sceneFadeChain =
        sceneFade > 0
          ? `fade=t=in:st=0:d=${sceneFade},fade=t=out:st=${(duration - sceneFade).toFixed(2)}:d=${sceneFade},`
          : "";

      // CTA animation (subscribe/share/bell) goes on AFTER the scene fade, so
      // one that spans several scenes stays solid across the cuts instead of
      // dipping to black with the footage. Plays once; eof_action=pass hides it.
      const ctaPlacement = ctaPlan[i];
      if (ctaPlacement) {
        const ctaInputIdx = overlayBaseInputIdx + activeOverlayCount;
        const ctaStart = ctaPlacement.start.toFixed(2);
        const box = ctaMaxBox(targetRatio);
        const maxW = Math.round(targetWidth * box.w);
        const maxH = Math.round(targetHeight * box.h);
        const yCenter = CTA_Y_FRACTION[cta.position];
        filterGraph += `[${currentLabel}]${sceneFadeChain}format=yuv420p[scene_faded];`;
        filterGraph += `[${ctaInputIdx}:v]format=rgba,scale=w=${maxW}:h=${maxH}:force_original_aspect_ratio=decrease,setpts=PTS-STARTPTS+${ctaStart}/TB[cta_src];`;
        filterGraph += `[scene_faded][cta_src]overlay=x=(W-w)/2:y=H*${yCenter}-h/2:eof_action=pass:enable='gte(t\\,${ctaStart})',format=yuv420p[outv]`;
      } else {
        filterGraph += `[${currentLabel}]${sceneFadeChain}format=yuv420p[outv]`;
      }

      const ffmpegArgs = ["-y"];
      if (hasValidAvatarFile) {
        // Input 0: Avatar video clip
        ffmpegArgs.push("-stream_loop", "-1", "-i", inputAvatarPath);
        // Input 1: Stock media (video or still photo)
        if (isVideoAsset(imageFilename)) {
          ffmpegArgs.push("-stream_loop", "-1", "-i", inputImagePath);
        } else if (preparedStillPath) {
          ffmpegArgs.push("-i", preparedStillPath);
        } else {
          ffmpegArgs.push("-loop", "1", "-i", inputImagePath);
        }
      } else if (sceneImageIsVideo) {
        ffmpegArgs.push("-stream_loop", "-1", "-i", inputImagePath);
      } else if (preparedStillPath) {
        ffmpegArgs.push("-i", preparedStillPath);
      } else {
        ffmpegArgs.push("-loop", "1", "-i", inputImagePath);
      }

      for (const ov of activePngList) {
        if (optimized) {
          // Only produce overlay frames for the overlay's visible window.
          const windowDur = Math.max(0.1, ov.end - ov.start).toFixed(2);
          ffmpegArgs.push("-loop", "1", "-framerate", "30", "-t", windowDur, "-i", ov.path);
        } else {
          ffmpegArgs.push("-loop", "1", "-i", ov.path);
        }
      }
      // Must stay the last input: the CTA filter indexes it after the overlays.
      if (ctaPlacement) {
        ffmpegArgs.push(...ctaInputArgs(resolveCtaFile(ctaPlacement.path), ctaPlacement.offset));
      }

      ffmpegArgs.push(
        "-t",
        duration.toString(),
        "-r",
        "30",
        "-filter_complex",
        filterGraph,
        "-map",
        "[outv]",
        "-c:v",
        "libx264",
        "-preset",
        FFMPEG_PRESET,
        "-pix_fmt",
        "yuv420p",
        "-threads",
        getFfmpegThreadsPerScene(),
        clipOutputPath,
      );

      await withRetry(() => runFFmpegProcess(ffmpegArgs, jobControl), {
        retries: FFMPEG_MAX_ATTEMPTS - 1,
        baseDelayMs: FFMPEG_RETRY_BASE_DELAY_MS,
        shouldRetry: (err) =>
          !(err instanceof Error && err.message === CANCELLED_ERROR_MESSAGE) &&
          !jobControl.cancelled,
      });

      scenesCompletedCount++;
      updateProgress(runId, {
        stage: "rendering_scenes",
        scenesCompleted: scenesCompletedCount,
        totalScenes: adjustedScenes.length,
      });
    }

    // Render scene clips with bounded concurrency instead of strictly serially —
    // scenes are independent (each writes its own clip_<i>.mp4), so a few can
    // run through FFmpeg at once without risking cross-scene interference.
    let nextSceneIndex = 0;
    let scenesCompletedCount = 0;
    updateProgress(runId, { stage: "rendering_scenes", scenesCompleted: 0, totalScenes: adjustedScenes.length });
    async function sceneWorker(): Promise<void> {
      while (true) {
        if (jobControl.cancelled) return;
        const current = nextSceneIndex++;
        if (current >= adjustedScenes.length) return;
        await renderSceneClip(current);
      }
    }
    await Promise.all(
      Array.from(
        { length: Math.min(SCENE_RENDER_CONCURRENCY, adjustedScenes.length) },
        () => sceneWorker(),
      ),
    );

    if (jobControl.cancelled) {
      throw new Error(CANCELLED_ERROR_MESSAGE);
    }

    updateProgress(runId, { stage: "merging" });

    const mergedVideoPath = path.join(tempDir, "merged_video.mp4");
    const concatTxtPath = path.join(tempDir, "concat.txt");
    const concatContent = clipPaths
      .map((p) => `file '${p.replace(/\\/g, "/")}'`)
      .join("\n");

    fs.writeFileSync(concatTxtPath, concatContent);

    const concatArgs = [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatTxtPath,
      "-c",
      "copy",
      "-metadata",
      `title=${videoTitle || "Auto Short"}`,
      "-metadata",
      `artist=${channelName || "Unknown Channel"}`,
      mergedVideoPath,
    ];

    await withRetry(() => runFFmpegProcess(concatArgs, jobControl), {
      retries: FFMPEG_MAX_ATTEMPTS - 1,
      baseDelayMs: FFMPEG_RETRY_BASE_DELAY_MS,
      shouldRetry: (err) =>
        !(err instanceof Error && err.message === CANCELLED_ERROR_MESSAGE) &&
        !jobControl.cancelled,
    });

    const outputVideoPath = path.join(generatedDir, "output.mp4");
    fs.copyFileSync(mergedVideoPath, outputVideoPath);

    // Also save a copy named after the source video's title/channel so the
    // file on disk (and the suggested download name) carries that context
    // instead of every generation overwriting a single generic filename.
    const savedFilename = buildSavedVideoFilename(videoTitle, channelName);
    const savedVideosDir = path.join(generatedDir, "saved");
    if (!fs.existsSync(savedVideosDir)) {
      fs.mkdirSync(savedVideosDir, { recursive: true });
    }
    // Keep only the most recent video: clear previous saves before copying.
    for (const oldFile of fs.readdirSync(savedVideosDir)) {
      try {
        fs.rmSync(path.join(savedVideosDir, oldFile), { recursive: true, force: true });
      } catch (err) {
        console.warn(`Failed to delete old saved video ${oldFile}:`, err);
      }
    }
    fs.copyFileSync(mergedVideoPath, path.join(savedVideosDir, savedFilename));

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn("Temporary directory cleanup failed:", cleanupErr);
    }

    finishJob(runId, {
      complete: true,
      error: null,
      videoPath: `/api/video?t=${Date.now()}`,
      stage: "done",
      scenesCompleted: adjustedScenes.length,
      totalScenes: adjustedScenes.length,
      savedFilename,
      substitutedScenes: substitutedScenes.length ? [...substitutedScenes].sort((a, b) => a - b) : undefined,
    });
    sweepStaleTempDirs(generatedDir);

    if (isCleanupEnabled()) {
      setTimeout(() => {
        cleanupAssets();
      }, CLEANUP_DELAY_MS);
    }
  } catch (error: unknown) {
    const isCancellation = error instanceof Error && error.message === CANCELLED_ERROR_MESSAGE;
    if (!isCancellation) {
      console.error("Error generating video via FFmpeg in background:", error);
    }
    await stopJobProcesses(jobControl);
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
    const errorMessage =
      error instanceof Error ? error.message : "FFmpeg compilation failed.";
    finishJob(runId, {
      complete: true,
      error: errorMessage,
      videoPath: null,
    });
    sweepStaleTempDirs(path.join(process.cwd(), "generated"));
  }
}

function runFFmpegProcess(args: string[], jobControl?: JobControl): Promise<string> {
  if (jobControl?.cancelled) {
    return Promise.reject(new Error(CANCELLED_ERROR_MESSAGE));
  }

  return new Promise((resolve, reject) => {
    console.log(`Executing FFmpeg: ${ffmpegPath} ${args.join(" ")}`);
    const proc = spawn(ffmpegPath, args);
    jobControl?.processes.add(proc);
    let stderr = "";
    let killedByCancel = false;

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      jobControl?.processes.delete(proc);
      if (killedByCancel || jobControl?.cancelled) {
        reject(new Error(CANCELLED_ERROR_MESSAGE));
      } else if (code === 0) {
        resolve(stderr);
      } else {
        reject(
          new Error(`FFmpeg exited with status ${code}. Stderr: ${stderr}`),
        );
      }
    });

    proc.on("error", (err) => {
      jobControl?.processes.delete(proc);
      reject(new Error(`FFmpeg start error: ${err.message}`));
    });

    // If cancellation arrives while this process is running, kill it so a
    // stopped generation doesn't keep FFmpeg burning CPU in the background.
    if (jobControl) {
      const cancelCheckInterval = setInterval(() => {
        if (jobControl.cancelled) {
          killedByCancel = true;
          clearInterval(cancelCheckInterval);
          try {
            proc.kill("SIGTERM");
          } catch {}
        }
      }, 500);
      proc.on("close", () => clearInterval(cancelCheckInterval));
    }
  });
}
