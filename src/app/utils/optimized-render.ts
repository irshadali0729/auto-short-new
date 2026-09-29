import sharp from "sharp";

// Helpers for the "Optimized generation" setting. Each one moves work that the
// legacy FFmpeg graph repeated on every frame (blurring a static photo,
// scaling a 6000px original, compositing full-frame transparent PNGs) into a
// single up-front pass, so FFmpeg only does the genuinely per-frame work.

// Background blur is computed at 1/4 resolution and upscaled — visually the
// same as boxblur=20:5 at full size for ~1/16th of the pixel work.
const BLUR_DOWNSCALE = 4;
const STILL_BG_BLUR_SIGMA = 8;
export const VIDEO_BG_BOXBLUR = "boxblur=5:5";

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

export function blurBackgroundSize(width: number, height: number) {
  return { w: even(width / BLUR_DOWNSCALE), h: even(height / BLUR_DOWNSCALE) };
}

/**
 * Bakes the full-frame still (blurred cover background + centered "contain"
 * foreground) into one JPEG at the target size. Decoding the original once
 * here also covers huge stock originals, so FFmpeg never touches them.
 */
export async function prepareStillComposite(
  inputPath: string,
  outputPath: string,
  width: number,
  height: number,
): Promise<void> {
  const source = await sharp(inputPath).rotate().toBuffer();
  const small = blurBackgroundSize(width, height);

  // Separate pipelines on purpose: sharp keeps only the last resize() of a
  // chain, so cover-crop+blur at 1/4 size must be materialized before upscaling.
  const smallBlurred = await sharp(source)
    .resize(small.w, small.h, { fit: "cover" })
    .blur(STILL_BG_BLUR_SIGMA)
    .toBuffer();
  const background = await sharp(smallBlurred)
    .resize(width, height, { fit: "fill" })
    .toBuffer();
  const foreground = await sharp(source)
    .resize(width, height, { fit: "inside" })
    .toBuffer();

  await sharp(background)
    .composite([{ input: foreground, gravity: "center" }])
    .jpeg({ quality: 92 })
    .toFile(outputPath);
}

/** Cover-crops a still to exactly width×height (split-screen stock half). */
export async function prepareStillCover(
  inputPath: string,
  outputPath: string,
  width: number,
  height: number,
): Promise<void> {
  await sharp(inputPath)
    .rotate()
    .resize(width, height, { fit: "cover" })
    .jpeg({ quality: 92 })
    .toFile(outputPath);
}

/**
 * Crops a full-frame transparent overlay PNG down to its visible pixels.
 * Returns the cropped file and where to place it, or null when the PNG is
 * fully transparent (nothing to composite).
 */
export async function cropOverlayToContent(
  inputPath: string,
  outputPath: string,
): Promise<{ path: string; x: number; y: number } | null> {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (data[row + x] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;

  // Keep even offsets/sizes so the overlay lines up with yuv420 chroma.
  const left = Math.floor(minX / 2) * 2;
  const top = Math.floor(minY / 2) * 2;
  const cropW = Math.min(width - left, even(maxX - left + 1));
  const cropH = Math.min(height - top, even(maxY - top + 1));

  await sharp(inputPath)
    .extract({ left, top, width: cropW, height: cropH })
    .png({ compressionLevel: 1 })
    .toFile(outputPath);
  return { path: outputPath, x: left, y: top };
}
