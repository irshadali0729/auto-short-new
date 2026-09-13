export type DuaCardTheme = "cream" | "light_grey" | "white";

export interface DuaInfo {
  isDua: boolean;
  hindi: string;
  arabic: string;
  title?: string;
  reference?: string;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const FONT_HINDI =
  "'Segoe UI', 'Montserrat', 'Nirmala UI', 'Mangal', 'Arial', 'DejaVu Sans', sans-serif";
const FONT_ARABIC =
  "'Traditional Arabic', 'Amiri', 'Scheherazade', 'Segoe UI', 'Arial', sans-serif";
const FONT_HEADER =
  "'Segoe UI', 'Montserrat', 'Nirmala UI', 'Arial', sans-serif";

function wrapLines(text: string, maxCharsPerLine: number = 32): string[] {
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
  return lines;
}

export function generateDuaCardSvg(
  dua: DuaInfo,
  targetWidth: number = 1080,
  targetHeight: number = 1920,
  theme: DuaCardTheme = "cream",
): string {
  const isLandscape = targetWidth > targetHeight;

  // Color palette per theme
  let cardBg = "#FAF6ED"; // Warm ivory / Cream
  let cardBorder = "#E2D3B3"; // Soft gold hairline
  let cardHeaderBg = "#F0E4CA";
  let cardHeaderBorder = "#D4BE92";
  let cardBadgeText = "#8C682A";
  let dividerColor = "#D4BE92";
  let hindiColor = "#1E293B"; // Deep slate / Charcoal for maximum legibility
  let arabicColor = "#064E3B"; // Rich Islamic deep emerald
  let referenceColor = "#64748B"; // Muted slate

  if (theme === "light_grey") {
    cardBg = "#F4F6F8";
    cardBorder = "#D1D5DB";
    cardHeaderBg = "#E5E7EB";
    cardHeaderBorder = "#CBD5E1";
    cardBadgeText = "#374151";
    dividerColor = "#CBD5E1";
    hindiColor = "#111827";
    arabicColor = "#1E3A8A"; // Deep royal navy
    referenceColor = "#6B7280";
  } else if (theme === "white") {
    cardBg = "#FFFFFF";
    cardBorder = "#E5E7EB";
    cardHeaderBg = "#F9FAFB";
    cardHeaderBorder = "#E5E7EB";
    cardBadgeText = "#B45309"; // Warm amber
    dividerColor = "#E5E7EB";
    hindiColor = "#111827";
    arabicColor = "#047857"; // Emerald green
    referenceColor = "#6B7280";
  }

  const maxCharsHindi = isLandscape ? 48 : 30;
  const maxCharsArabic = isLandscape ? 44 : 26;

  const hindiLines = wrapLines(dua.hindi || "", maxCharsHindi).slice(0, 4);
  const arabicLines = wrapLines(dua.arabic || "", maxCharsArabic).slice(0, 4);

  const hindiLineHeight = isLandscape ? 50 : 58;
  const arabicLineHeight = isLandscape ? 62 : 72;

  const hindiFontSize = hindiLines.length > 2 ? (isLandscape ? 34 : 38) : (isLandscape ? 38 : 44);
  const arabicFontSize = arabicLines.length > 2 ? (isLandscape ? 42 : 48) : (isLandscape ? 48 : 56);

  // Card dimensions & positioning (Centered on screen with safe margins)
  const cardWidth = isLandscape ? Math.min(targetWidth - 240, 1100) : Math.min(targetWidth - 90, 990);
  const cardX = (targetWidth - cardWidth) / 2;

  const headerHeight = isLandscape ? 64 : 74;
  const hindiBlockHeight = hindiLines.length * hindiLineHeight;
  const dividerHeight = 36;
  const arabicBlockHeight = arabicLines.length * arabicLineHeight;
  const footerHeight = dua.reference ? (isLandscape ? 40 : 48) : 20;
  const paddingY = isLandscape ? 36 : 46;

  const contentHeight =
    headerHeight +
    hindiBlockHeight +
    dividerHeight +
    arabicBlockHeight +
    footerHeight +
    paddingY * 2;

  const cardHeight = Math.min(targetHeight - 120, Math.max(isLandscape ? 480 : 620, contentHeight));
  const cardY = (targetHeight - cardHeight) / 2;

  const centerX = targetWidth / 2;

  // Header positioning
  const headerBadgeWidth = isLandscape ? 260 : 310;
  const headerBadgeHeight = isLandscape ? 44 : 52;
  const headerBadgeX = centerX - headerBadgeWidth / 2;
  const headerBadgeY = cardY + paddingY;

  // Hindi text positioning (Top)
  const hindiStartY = headerBadgeY + headerBadgeHeight + (isLandscape ? 44 : 56);
  const hindiTspans = hindiLines
    .map((line, idx) => {
      const y = hindiStartY + idx * hindiLineHeight;
      return `<tspan x="${centerX}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("\n");

  // Divider positioning
  const dividerY = hindiStartY + hindiBlockHeight + 10;
  const dividerWidth = cardWidth - (isLandscape ? 180 : 140);
  const dividerX = centerX - dividerWidth / 2;

  // Arabic text positioning (Below Hindi)
  const arabicStartY = dividerY + (isLandscape ? 48 : 60);
  const arabicTspans = arabicLines
    .map((line, idx) => {
      const y = arabicStartY + idx * arabicLineHeight;
      return `<tspan x="${centerX}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("\n");

  // Reference footer positioning
  const referenceY = arabicStartY + arabicBlockHeight + (isLandscape ? 24 : 32);

  return `
  <svg width="${targetWidth}" height="${targetHeight}" viewBox="0 0 ${targetWidth} ${targetHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Premium Multi-layer Drop Shadow for Dua Card -->
      <filter id="duaCardShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="16" stdDeviation="28" flood-color="#000000" flood-opacity="0.60" />
        <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#000000" flood-opacity="0.35" />
      </filter>

      <filter id="badgeShadow" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.12" />
      </filter>

      <linearGradient id="goldFiligree" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${dividerColor}" stop-opacity="0.1" />
        <stop offset="50%" stop-color="${dividerColor}" stop-opacity="0.95" />
        <stop offset="100%" stop-color="${dividerColor}" stop-opacity="0.1" />
      </linearGradient>
    </defs>

    <!-- Ambient Dimming Scrim Background behind Dua Card for Focus -->
    <rect width="${targetWidth}" height="${targetHeight}" fill="#000000" fill-opacity="0.45" />

    <!-- Main Dua Card Container -->
    <g filter="url(#duaCardShadow)">
      <rect
        x="${cardX}"
        y="${cardY}"
        width="${cardWidth}"
        height="${cardHeight}"
        rx="28"
        ry="28"
        fill="${cardBg}"
        stroke="${cardBorder}"
        stroke-width="3"
      />
      <!-- Inner hairline accent border for luxurious Islamic aesthetic -->
      <rect
        x="${cardX + 8}"
        y="${cardY + 8}"
        width="${cardWidth - 16}"
        height="${cardHeight - 16}"
        rx="22"
        ry="22"
        fill="none"
        stroke="${cardBorder}"
        stroke-width="1"
        stroke-opacity="0.6"
      />
    </g>

    <!-- Top Spiritual Badge / Header -->
    <g filter="url(#badgeShadow)">
      <rect
        x="${headerBadgeX}"
        y="${headerBadgeY}"
        width="${headerBadgeWidth}"
        height="${headerBadgeHeight}"
        rx="26"
        ry="26"
        fill="${cardHeaderBg}"
        stroke="${cardHeaderBorder}"
        stroke-width="1.5"
      />
      <text
        x="${centerX}"
        y="${headerBadgeY + (isLandscape ? 28 : 34)}"
        font-family="${FONT_HEADER}"
        font-size="${isLandscape ? 17 : 20}"
        font-weight="800"
        letter-spacing="1.5"
        text-anchor="middle"
        fill="${cardBadgeText}"
      >
        🤲 ${escapeXml(dua.title ? dua.title.toUpperCase() : "DUA • दुआ • دعاء")}
      </text>
    </g>

    <!-- Hindi / Devanagari Pronunciation & Recitation (Top) -->
    <text
      font-family="${FONT_HINDI}"
      font-size="${hindiFontSize}"
      font-weight="700"
      text-anchor="middle"
      fill="${hindiColor}"
      letter-spacing="0.2"
    >
      ${hindiTspans}
    </text>

    <!-- Decorative Islamic Divider -->
    <line
      x1="${dividerX}"
      y1="${dividerY}"
      x2="${dividerX + dividerWidth}"
      y2="${dividerY}"
      stroke="url(#goldFiligree)"
      stroke-width="2"
      stroke-linecap="round"
    />
    <circle cx="${centerX}" cy="${dividerY}" r="4.5" fill="${dividerColor}" />
    <circle cx="${centerX - 16}" cy="${dividerY}" r="2.5" fill="${dividerColor}" fill-opacity="0.7" />
    <circle cx="${centerX + 16}" cy="${dividerY}" r="2.5" fill="${dividerColor}" fill-opacity="0.7" />

    <!-- Arabic Script with Full Tashkeel / Harakat (Below Hindi) -->
    <text
      font-family="${FONT_ARABIC}"
      font-size="${arabicFontSize}"
      font-weight="700"
      text-anchor="middle"
      fill="${arabicColor}"
      direction="rtl"
      unicode-bidi="bidi-override"
    >
      ${arabicTspans}
    </text>

    <!-- Optional Reference Footer -->
    ${
      dua.reference
        ? `
    <text
      x="${centerX}"
      y="${referenceY}"
      font-family="${FONT_HINDI}"
      font-size="${isLandscape ? 15 : 18}"
      font-weight="600"
      text-anchor="middle"
      fill="${referenceColor}"
      letter-spacing="0.5"
    >
      ${escapeXml(dua.reference)}
    </text>
    `
        : ""
    }
  </svg>
  `.trim();
}
