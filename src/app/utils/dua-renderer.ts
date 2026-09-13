import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  DuaInfo,
  DuaCardTheme,
  generateDuaCardSvg,
} from "./dua-card-svg";

export type { DuaCardTheme, DuaInfo };
export { generateDuaCardSvg };

export async function renderDuaOverlayPng(
  dua: DuaInfo,
  outputPath: string,
  targetWidth: number = 1080,
  targetHeight: number = 1920,
  theme: DuaCardTheme = "cream",
): Promise<string> {
  const svgString = generateDuaCardSvg(dua, targetWidth, targetHeight, theme);

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await sharp(Buffer.from(svgString))
    .resize(targetWidth, targetHeight)
    .png({ compressionLevel: 6 })
    .toFile(outputPath);

  return outputPath;
}
