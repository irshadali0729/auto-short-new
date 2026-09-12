import fs from "fs";
import path from "path";
import sharp from "sharp";

export interface GraphicBeat {
  prefixText?: string;
  heroWord: string;
  suffixText?: string;
  style?: "stacked-kinetic" | "top-hero" | "thought-bubble" | "breakdown-card";
  text?: string;
  accent?: string;
  type?: "impact" | "money" | "result" | "platform";
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
const FONT_DISPLAY = "'Georgia', 'Times New Roman', 'Segoe UI', 'Mangal', 'Nirmala UI', serif";

function buildDefs(): string {
  return `
  <defs>
    <!-- Warm Sunburst Gold Gradient for Hero Words -->
    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFF9C4" />
      <stop offset="20%" stop-color="#FDD835" />
      <stop offset="65%" stop-color="#F57F17" />
      <stop offset="100%" stop-color="#E65100" />
    </linearGradient>

    <!-- Vivid Sunset Orange Gradient -->
    <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFEE58" />
      <stop offset="25%" stop-color="#FFA726" />
      <stop offset="70%" stop-color="#F57C00" />
      <stop offset="100%" stop-color="#D84315" />
    </linearGradient>

    <!-- Deep Drop Shadow Filter for Hero Text -->
    <filter id="heroShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="3" dy="6" stdDeviation="4" flood-color="#000000" flood-opacity="0.95" />
      <feDropShadow dx="0" dy="2" stdDeviation="8" flood-color="#000000" flood-opacity="0.7" />
    </filter>

    <!-- Crisp Drop Shadow for White Context Subtitles -->
    <filter id="subShadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="2" dy="4" stdDeviation="3" flood-color="#000000" flood-opacity="0.9" />
    </filter>
  </defs>`;
}

export function generateOverlaySvg(beat: GraphicBeat): string {
  const style = beat.style || "stacked-kinetic";
  const prefix = beat.prefixText ? escapeXml(beat.prefixText.trim()) : "";
  const hero = escapeXml((beat.heroWord || "FOCUS").trim());
  const suffix = beat.suffixText ? escapeXml(beat.suffixText.trim()) : "";

  if (style === "thought-bubble") {
    const bubbleQuote = prefix ? `“${prefix} ${hero}”` : `“${hero}”`;
    return `
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
      ${buildDefs()}
      
      <!-- Subtle Golden Background Glow Accent -->
      <text x="540" y="860"
        font-family="${FONT_DISPLAY}"
        font-size="160"
        font-weight="900"
        text-anchor="middle"
        fill="url(#goldGradient)"
        fill-opacity="0.88"
        stroke="#000000"
        stroke-width="12"
        stroke-linejoin="round"
        paint-order="stroke fill"
        filter="url(#heroShadow)">
        ${hero}
      </text>

      <!-- Thought Bubble Cloud Vector Shape -->
      <g filter="url(#heroShadow)">
        <path d="
          M 340,530
          C 300,530 260,560 260,605
          C 230,620 220,665 240,700
          C 220,740 250,785 295,795
          C 320,830 380,845 430,835
          C 460,865 520,875 580,865
          C 640,880 710,865 745,830
          C 795,840 850,815 870,770
          C 910,745 915,690 890,650
          C 910,610 885,555 840,540
          C 820,490 750,470 700,485
          C 650,455 580,460 530,480
          C 475,455 400,465 365,500
          C 350,510 345,520 340,530 Z"
          fill="#FFFFFF"
          stroke="#000000"
          stroke-width="10"
          stroke-linejoin="round"
        />
        <!-- Tail circles pointing down to speaker -->
        <circle cx="430" cy="880" r="16" fill="#FFFFFF" stroke="#000000" stroke-width="7" />
        <circle cx="410" cy="918" r="9" fill="#FFFFFF" stroke="#000000" stroke-width="5" />
      </g>

      <!-- Quoted thought text inside bubble -->
      <text x="560" y="670"
        font-family="${FONT_SANS}"
        font-size="52"
        font-weight="900"
        text-anchor="middle"
        fill="#050505">
        ${bubbleQuote}
      </text>
    </svg>`;
  }

  if (style === "top-hero") {
    return `
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
      ${buildDefs()}

      <!-- Top Dramatic Hero Word (e.g. 'excuse') -->
      <text x="540" y="420"
        font-family="${FONT_SANS}"
        font-size="140"
        font-weight="900"
        text-anchor="middle"
        fill="url(#orangeGradient)"
        stroke="#000000"
        stroke-width="16"
        stroke-linejoin="round"
        paint-order="stroke fill"
        filter="url(#heroShadow)">
        ${hero}
      </text>

      <!-- Lower White Context Question (e.g. 'not to pray?') -->
      ${
        prefix
          ? `<text x="540" y="1090"
              font-family="${FONT_SANS}"
              font-size="82"
              font-weight="800"
              text-anchor="middle"
              fill="#FFFFFF"
              stroke="#000000"
              stroke-width="12"
              stroke-linejoin="round"
              paint-order="stroke fill"
              filter="url(#subShadow)">
              ${prefix}
            </text>`
          : ""
      }
    </svg>`;
  }

  // Default: stacked-kinetic (Matches Images 1 & 3 & 5)
  const hasPrefix = Boolean(prefix);
  const hasSuffix = Boolean(suffix);

  let prefixY = 1180;
  let heroY = 1310;
  let suffixY = 1420;

  if (hasPrefix && hasSuffix) {
    prefixY = 1130;
    heroY = 1260;
    suffixY = 1380;
  } else if (!hasPrefix && !hasSuffix) {
    heroY = 1250;
  }

  return `
  <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    ${buildDefs()}

    <!-- Support Context Text (Line 1, e.g. "I don't have", "We deal with", "only take about") -->
    ${
      hasPrefix
        ? `<text x="540" y="${prefixY}"
            font-family="${FONT_SANS}"
            font-size="70"
            font-weight="800"
            text-anchor="middle"
            fill="#FFFFFF"
            stroke="#000000"
            stroke-width="12"
            stroke-linejoin="round"
            paint-order="stroke fill"
            filter="url(#subShadow)">
            ${prefix}
          </text>`
        : ""
    }

    <!-- Hero Punchline Word (Line 2, e.g. "time.", "many", "an hour.") -->
    <text x="540" y="${heroY}"
      font-family="${FONT_DISPLAY}"
      font-size="134"
      font-weight="900"
      text-anchor="middle"
      fill="url(#goldGradient)"
      stroke="#000000"
      stroke-width="16"
      stroke-linejoin="round"
      paint-order="stroke fill"
      filter="url(#heroShadow)">
      ${hero}
    </text>

    <!-- Suffix Support Text (Line 3, e.g. "things") -->
    ${
      hasSuffix
        ? `<text x="540" y="${suffixY}"
            font-family="${FONT_SANS}"
            font-size="70"
            font-weight="800"
            text-anchor="middle"
            fill="#FFFFFF"
            stroke="#000000"
            stroke-width="12"
            stroke-linejoin="round"
            paint-order="stroke fill"
            filter="url(#subShadow)">
            ${suffix}
          </text>`
        : ""
    }
  </svg>`;
}

export async function renderGraphicOverlayPng(
  beat: GraphicBeat,
  outputPath: string,
): Promise<string> {
  const svgString = generateOverlaySvg(beat);
  const buffer = Buffer.from(svgString, "utf-8");

  await sharp(buffer)
    .resize(1080, 1920)
    .png({ compressionLevel: 6, adaptiveFiltering: false })
    .toFile(outputPath);

  return outputPath;
}
