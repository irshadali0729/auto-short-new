import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { CTA_TYPES, type CtaLibrary, type CtaType, type CtaVariant } from "@/app/utils/cta-shared";

// Server-side CTA file access. Animations live in image-library/cta/<type>/
// (transparent .webm preferred; .gif/.mov also work). Folders starting with
// "_" (e.g. _source) are ignored. Placement logic is in cta-shared.ts.

const LIBRARY_DIR = path.join(process.cwd(), "image-library");
const CTA_EXTENSIONS = [".webm", ".mov", ".gif"];

// Clip length per file, re-probed only when the file changes.
const durationCache = new Map<string, { mtimeMs: number; duration: number }>();

function probeDurationSec(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegInstaller.path, ["-hide_banner", "-i", filePath]);
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", () => resolve(0));
    // `ffmpeg -i` with no output exits non-zero but still prints the header.
    proc.on("close", () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
      resolve(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0);
    });
  });
}

async function getDuration(filePath: string): Promise<number> {
  try {
    const { mtimeMs } = await fs.promises.stat(filePath);
    const cached = durationCache.get(filePath);
    if (cached && cached.mtimeMs === mtimeMs) return cached.duration;
    const duration = await probeDurationSec(filePath);
    durationCache.set(filePath, { mtimeMs, duration });
    return duration;
  } catch {
    return 0;
  }
}

async function listVariants(type: CtaType): Promise<CtaVariant[]> {
  const dir = path.join(LIBRARY_DIR, "cta", type);
  let names: string[];
  try {
    names = (await fs.promises.readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isFile() && CTA_EXTENSIONS.includes(path.extname(e.name).toLowerCase()))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
  return Promise.all(
    names.map(async (name) => ({
      path: `cta/${type}/${name}`,
      duration: Number((await getDuration(path.join(dir, name))).toFixed(2)),
    })),
  );
}

export async function loadCtaLibrary(): Promise<CtaLibrary> {
  const lists = await Promise.all(CTA_TYPES.map(listVariants));
  return Object.fromEntries(CTA_TYPES.map((t, i) => [t, lists[i]])) as CtaLibrary;
}

export function resolveCtaFile(relativePath: string): string {
  return path.join(LIBRARY_DIR, relativePath);
}

/**
 * FFmpeg input args for a CTA file (VP9 needs libvpx to keep its alpha).
 * `offsetSec` seeks into the animation when it continues from a previous scene.
 */
export function ctaInputArgs(filePath: string, offsetSec = 0): string[] {
  const seek = offsetSec > 0 ? ["-ss", offsetSec.toFixed(2)] : [];
  const decoder = path.extname(filePath).toLowerCase() === ".webm" ? ["-c:v", "libvpx-vp9"] : [];
  return [...seek, ...decoder, "-i", filePath];
}
