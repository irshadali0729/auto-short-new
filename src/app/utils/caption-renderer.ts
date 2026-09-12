import fs from "fs";
import path from "path";
import sharp from "sharp";

export interface CaptionSlice {
  text: string;
  start: number;
  end: number;
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

export function generateCaptionSvg(captionText: string): string {
  const lines = wrapText(captionText, 34);
  const lineCount = lines.length || 1;
  const lineHeight = 68;
  const fontSize = lineCount > 2 ? 44 : lineCount === 2 ? 50 : 54;

  // Position in lower third, safely above YouTube Shorts bottom metadata
  const baseY = 1480 - (lineCount - 1) * (lineHeight / 2);

  // Calculate pill background dimensions
  const maxLineLength = Math.max(...lines.map((l) => l.length), 10);
  const pillWidth = Math.min(980, Math.max(320, maxLineLength * (fontSize * 0.58) + 64));
  const pillHeight = lineCount * lineHeight + 36;
  const pillX = 540 - pillWidth / 2;
  const pillY = baseY - fontSize + (fontSize === 54 ? 2 : -2) - 16;

  const textTspans = lines
    .map((line, idx) => {
      const yPos = baseY + idx * lineHeight;
      return `<tspan x="540" y="${yPos}">${escapeXml(line)}</tspan>`;
    })
    .join("\n");

  return `
  <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="pillShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.8" />
      </filter>
      <filter id="captionShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="3" stdDeviation="2" flood-color="#000000" flood-opacity="0.9" />
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
  </svg>
  `.trim();
}

export async function renderCaptionOverlayPng(
  captionText: string,
  outputPath: string,
): Promise<string> {
  const svgString = generateCaptionSvg(captionText);
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await sharp(Buffer.from(svgString))
    .png({ compressionLevel: 6 })
    .toFile(outputPath);

  return outputPath;
}
