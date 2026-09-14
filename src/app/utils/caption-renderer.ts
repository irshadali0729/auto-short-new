import fs from "fs";
import path from "path";
import sharp from "sharp";
import { EmojiStyle, resolveEmojiDataUri } from "@/app/utils/emoji-resolver";

export interface CaptionSlice {
  text: string;
  start: number;
  end: number;
  emoji?: string;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const FONT_SANS = "'Segoe UI', 'Montserrat', 'Nirmala UI', 'Mangal', 'Arial', 'DejaVu Sans', sans-serif";

function wrapText(text: string, maxCharsPerLine: number = 34): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + " " + word).length <= maxCharsPerLine) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines.slice(0, 3);
}

export type CaptionPosition = "top" | "middle" | "bottom";

export function generateCaptionSvg(
  captionText: string,
  targetWidth: number = 1080,
  targetHeight: number = 1920,
  emojiDataUri?: string | null,
  captionPosition: CaptionPosition = "bottom",
): string {
  const isLandscape = targetWidth > targetHeight;
  const maxChars = isLandscape ? 52 : 34;
  const lines = wrapText(captionText, maxChars);
  const lineCount = lines.length || 1;
  const lineHeight = isLandscape ? 60 : 68;
  const fontSize = lineCount > 2 ? (isLandscape ? 40 : 44) : lineCount === 2 ? (isLandscape ? 46 : 50) : (isLandscape ? 50 : 54);

  // Position based on captionPosition: top, middle (center screen), or bottom (lower third)
  let targetBaseRatio: number;
  if (captionPosition === "top") {
    targetBaseRatio = isLandscape ? 0.22 : 0.18;
  } else if (captionPosition === "middle") {
    targetBaseRatio = 0.50;
  } else {
    // "bottom" (default)
    targetBaseRatio = isLandscape ? 0.82 : 0.77;
  }
  const baseY = Math.round(targetHeight * targetBaseRatio) - (lineCount - 1) * (lineHeight / 2);
  const centerX = targetWidth / 2;

  // Calculate pill background dimensions
  const maxLineLength = Math.max(...lines.map((l) => l.length), 10);
  const pillWidth = Math.min(targetWidth - 80, Math.max(320, maxLineLength * (fontSize * 0.58) + 64));
  const pillHeight = lineCount * lineHeight + 36;
  const pillX = centerX - pillWidth / 2;
  const pillY = baseY - fontSize + (fontSize === 54 ? 2 : -2) - 16;

  // 3D Emoji positioning (centered above or overlapping the top of the pill)
  const emojiSize = isLandscape ? 68 : 82;
  const emojiX = centerX - emojiSize / 2;
  const emojiY = pillY - emojiSize * 0.68;

  const textTspans = lines
    .map((line, idx) => {
      const yPos = baseY + idx * lineHeight;
      return `<tspan x="${centerX}" y="${yPos}">${escapeXml(line)}</tspan>`;
    })
    .join("\n");

  return `
  <svg width="${targetWidth}" height="${targetHeight}" viewBox="0 0 ${targetWidth} ${targetHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="pillShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.8" />
      </filter>
      <filter id="captionShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="3" stdDeviation="2" flood-color="#000000" flood-opacity="0.9" />
      </filter>
      <filter id="emojiShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000000" flood-opacity="0.85" />
      </filter>
    </defs>

    <!-- Translucent Dark Pill Badge for Maximum Readability -->
    <rect 
      x="${pillX}" 
      y="${pillY}" 
      width="${pillWidth}" 
      height="${pillHeight}" 
      rx="20" 
      ry="20" 
      fill="#000000" 
      fill-opacity="0.65" 
      stroke="#FFFFFF" 
      stroke-width="1.5" 
      stroke-opacity="0.18"
      filter="url(#pillShadow)" 
    />

    <!-- High-Contrast Subtitle Text -->
    <text
      font-family="${FONT_SANS}"
      font-size="${fontSize}"
      font-weight="800"
      text-anchor="middle"
      fill="#FFFFFF"
      stroke="#000000"
      stroke-width="6"
      stroke-linejoin="round"
      paint-order="stroke fill"
      filter="url(#captionShadow)"
    >
      ${textTspans}
    </text>

    <!-- 3D Emoji Badge Overlap -->
    ${
      emojiDataUri
        ? `<image href="${emojiDataUri}" x="${emojiX}" y="${emojiY}" width="${emojiSize}" height="${emojiSize}" filter="url(#emojiShadow)" />`
        : ""
    }
  </svg>
  `.trim();
}

export async function renderCaptionOverlayPng(
  captionText: string,
  outputPath: string,
  targetWidth: number = 1080,
  targetHeight: number = 1920,
  emoji?: string,
  emojiStyle: EmojiStyle = "fluent",
  captionPosition: CaptionPosition = "bottom",
): Promise<string> {
  let emojiDataUri: string | null = null;
  if (emoji) {
    try {
      emojiDataUri = await resolveEmojiDataUri(emoji, emojiStyle);
    } catch (err) {
      console.warn("Failed to resolve emoji data URI:", err);
    }
  }

  const svgString = generateCaptionSvg(
    captionText,
    targetWidth,
    targetHeight,
    emojiDataUri,
    captionPosition,
  );

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
