import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { cleanupAssets } from "@/app/utils/cleanup";
import {
  GraphicBeat,
  renderGraphicOverlayPng,
} from "@/app/utils/graphics-renderer";
import {
  CaptionSlice,
  CaptionPosition,
  renderCaptionOverlayPng,
} from "@/app/utils/caption-renderer";
import {
  DuaInfo,
  DuaCardTheme,
  renderDuaOverlayPng,
} from "@/app/utils/dua-renderer";

const ffmpegPath = ffmpegInstaller.path;

interface Scene {
  keyword: string;
  duration: number;
  image: string;
  isFallback: boolean;
  isHostScene?: boolean;
  isSplitScreen?: boolean;
  hostAsset?: string;
  stockAsset?: string;
  emoji?: string;
  graphics?: GraphicBeat[];
  captions?: CaptionSlice[];
  duaInfo?: DuaInfo;
}

interface ProgressData {
  complete: boolean;
  error: string | null;
  videoPath: string | null;
}

interface CustomGlobal {
  videoProgress?: Map<string, ProgressData>;
}

const customGlobal = global as unknown as CustomGlobal;
if (!customGlobal.videoProgress) {
  customGlobal.videoProgress = new Map();
}
const progressMap = customGlobal.videoProgress;

function escapeFilterText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
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

function getFontFileParam(): string {
  const fontPaths = [
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  ];
  for (const p of fontPaths) {
    if (fs.existsSync(p)) {
      const escaped = p.replace(/\\/g, "/").replace(/:/g, "\\:");
      return `fontfile='${escaped}'`;
    }
  }
  return "font='Arial'";
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
      zoomSpeed,
      transitionDuration,
      textOverlayMode,
      captionPosition,
      enableGraphicMotion,
      enableCaptions,
      aspectRatio,
      enableEmojiCaptions,
      emojiStyle,
      enableDuaOverlay,
      duaCardTheme,
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
    ).catch((err) => {
      console.error("Background compilation crash:", err);
      progressMap.set(runId, {
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
) {
  let tempDir = "";
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

    const adjustedScenes = scenes.map((scene) => ({
      ...scene,
      duration: Number(Number(scene.duration || 5).toFixed(2)),
      graphics:
        Array.isArray(scene.graphics) && scene.graphics.length > 0
          ? scene.graphics
          : buildDefaultGraphicBeats(Number(scene.duration) || 5),
    }));

    const clipPaths: string[] = [];

async function resolveSceneAsset(
  assetPathOrUrl: string,
  imageLibraryDir: string,
  tempDir: string,
  tempPrefix: string,
): Promise<string> {
  if (!assetPathOrUrl) return "";

  if (assetPathOrUrl.startsWith("http://") || assetPathOrUrl.startsWith("https://")) {
    const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(assetPathOrUrl);
    const ext = isVideo ? ".mp4" : ".jpg";
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

    for (let i = 0; i < adjustedScenes.length; i++) {
      const scene = adjustedScenes[i];
      const imageFilename = scene.image;
      const duration = scene.duration;

      const inputImagePath = await resolveSceneAsset(imageFilename, imageLibraryDir, tempDir, `remote_scene_${i}`);

      const clipOutputPath = path.join(tempDir, `clip_${i}.mp4`);
      clipPaths.push(clipOutputPath);

      const isZoomIn = i % 2 === 0;
      const speedStep = 0.0006 * zoomSpeedMultiplier;
      const zoomExpression = isZoomIn
        ? `min(1.0+on*${speedStep},1.15)`
        : `max(1.15-on*${speedStep},1.0)`;

      const sceneFade = Math.min(transitionDuration, duration / 2);

      const beats =
        Array.isArray(scene.graphics) && scene.graphics.length > 0
          ? scene.graphics
          : buildDefaultGraphicBeats(duration);

      const overlayPngList: Array<{ path: string; start: number; end: number }> = [];
      const captionPngList: Array<{ path: string; start: number; end: number }> = [];

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
            scene.duaInfo!,
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
          try {
            await renderGraphicOverlayPng(beat, overlayPath, targetWidth, targetHeight);
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

      const isVideoAsset = /\.(mp4|webm|mov)(\?.*)?$/i.test(imageFilename);

      const isSplitScreenScene = Boolean(scene.isSplitScreen && scene.hostAsset);
      const hostFilename = scene.hostAsset || "";
      const inputHostPath = isSplitScreenScene
        ? await resolveSceneAsset(hostFilename, imageLibraryDir, tempDir, `remote_host_${i}`)
        : "";
      const hasValidHostFile = isSplitScreenScene && Boolean(inputHostPath && fs.existsSync(inputHostPath));


      let filterGraph = "";
      let overlayBaseInputIdx = 1;

      if (hasValidHostFile) {
        overlayBaseInputIdx = 2; // Input 0: Host Video, Input 1: Stock Media
        const isStockVideo = /\.(mp4|webm|mov)$/i.test(imageFilename);

        if (targetRatio === "16:9") {
          // Landscape: Left/Right 50/50 Split
          const halfWidth = Math.floor(targetWidth / 2);
          const dividerX = halfWidth - 2;

          let stockChain = "";
          if (isStockVideo) {
            stockChain = `[1:v]scale=${halfWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${halfWidth}:${targetHeight},setpts=PTS-STARTPTS[right];`;
          } else {
            stockChain =
              `[1:v]scale=${halfWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${halfWidth}:${targetHeight}[r_still];` +
              `[r_still]zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2':d=1:s=${halfWidth}x${targetHeight}:fps=30[right];`;
          }

          filterGraph =
            `[0:v]scale=${halfWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${halfWidth}:${targetHeight},setpts=PTS-STARTPTS[left];` +
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
            stockChain = `[1:v]scale=${targetWidth}:${halfHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${halfHeight},setpts=PTS-STARTPTS[bottom];`;
          } else {
            stockChain =
              `[1:v]scale=${targetWidth}:${halfHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${halfHeight}[b_still];` +
              `[b_still]zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2':d=1:s=${targetWidth}x${halfHeight}:fps=30[bottom];`;
          }

          filterGraph =
            `[0:v]scale=${targetWidth}:${halfHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${halfHeight},setpts=PTS-STARTPTS[top];` +
            stockChain +
            `[top][bottom]vstack=inputs=2[split_raw];` +
            `[split_raw]drawbox=x=0:y=${dividerY}:w=${targetWidth}:h=4:color=white@0.35:t=fill[zoomed];` +
            `[zoomed]drawgrid=width=100:height=100:thickness=1:color=white@0.04[grid];`;
        }
      } else if (isVideoAsset) {
        filterGraph =
          `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},boxblur=20:5,setpts=PTS-STARTPTS[bg];` +
          `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,setpts=PTS-STARTPTS[fg_scaled];` +
          `[bg][fg_scaled]overlay=(W-w)/2:(H-h)/2[zoomed];` +
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

      // Mutually exclusive overlay composition into FFmpeg filter graph
      if (textOverlayMode === "captions" && captionPngList.length > 0) {
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

          filterGraph += `[${inputIdx}:v]format=rgba,fade=t=in:st=${st}:d=${fadeIn}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${fadeOut}:alpha=1[${fadedLabel}];`;
          filterGraph += `[${currentLabel}][${fadedLabel}]overlay=x=0:y=0:enable='between(t\\,${st}\\,${et})'[${nextLabel}];`;
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
            filterGraph += `[${inputIdx}:v]format=rgba,fade=t=in:st=${st}:d=${fadeInDur}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${fadeOutDur}:alpha=1[${fadedLabel}];`;

            // Kinetic slide-up 35px into rest position, evaluated per frame with escaped commas
            const yExpr = `'if(lt(t\\,${st})\\,35\\,if(lt(t\\,${st}+0.25)\\,35*(1-(t-${st})/0.25)\\,0))'`;
            filterGraph += `[${currentLabel}][${fadedLabel}]overlay=x=0:y=${yExpr}:eval=frame:enable='between(t\\,${st}\\,${et})'[${nextLabel}];`;
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

      if (sceneFade > 0) {
        filterGraph += `[${currentLabel}]fade=t=in:st=0:d=${sceneFade},fade=t=out:st=${(duration - sceneFade).toFixed(2)}:d=${sceneFade},format=yuv420p[outv]`;
      } else {
        filterGraph += `[${currentLabel}]format=yuv420p[outv]`;
      }

      const ffmpegArgs = ["-y"];
      if (hasValidHostFile) {
        // Input 0: Host video clip
        ffmpegArgs.push("-stream_loop", "-1", "-i", inputHostPath);
        // Input 1: Stock media (video or still photo)
        if (/\.(mp4|webm|mov)$/i.test(imageFilename)) {
          ffmpegArgs.push("-stream_loop", "-1", "-i", inputImagePath);
        } else {
          ffmpegArgs.push("-loop", "1", "-i", inputImagePath);
        }
      } else if (isVideoAsset) {
        ffmpegArgs.push("-stream_loop", "-1", "-i", inputImagePath);
      } else {
        ffmpegArgs.push("-loop", "1", "-i", inputImagePath);
      }

      const activePngList =
        textOverlayMode === "captions"
          ? captionPngList
          : textOverlayMode === "graphics"
            ? overlayPngList
            : [];

      for (const ov of activePngList) {
        ffmpegArgs.push("-loop", "1", "-i", ov.path);
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
        "superfast",
        "-pix_fmt",
        "yuv420p",
        "-threads",
        "2",
        clipOutputPath,
      );

      await runFFmpegProcess(ffmpegArgs);
    }

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
      mergedVideoPath,
    ];

    await runFFmpegProcess(concatArgs);

    const outputVideoPath = path.join(generatedDir, "output.mp4");
    fs.copyFileSync(mergedVideoPath, outputVideoPath);

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn("Temporary directory cleanup failed:", cleanupErr);
    }

    progressMap.set(runId, {
      complete: true,
      error: null,
      videoPath: `/api/video?t=${Date.now()}`,
    });

    const isProduction =
      process.env.NODE_ENV === "production" ||
      process.env.CLEANUP_ASSETS === "true";
    if (isProduction) {
      setTimeout(
        () => {
          cleanupAssets();
        },
        10 * 60 * 1000,
      );
    }
  } catch (error: unknown) {
    console.error("Error generating video via FFmpeg in background:", error);
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
    const errorMessage =
      error instanceof Error ? error.message : "FFmpeg compilation failed.";
    progressMap.set(runId, {
      complete: true,
      error: errorMessage,
      videoPath: null,
    });
  }
}

function runFFmpegProcess(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`Executing FFmpeg: ${ffmpegPath} ${args.join(" ")}`);
    const proc = spawn(ffmpegPath, args);
    let stderr = "";

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stderr);
      } else {
        reject(
          new Error(`FFmpeg exited with status ${code}. Stderr: ${stderr}`),
        );
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`FFmpeg start error: ${err.message}`));
    });
  });
}
