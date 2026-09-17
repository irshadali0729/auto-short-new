import type { DuaCardTheme, DuaCardPosition, DuaCardStyle, DuaInfo } from "@/app/types/scene";

export type { DuaCardTheme, DuaCardPosition, DuaCardStyle, DuaInfo } from "@/app/types/scene";

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
  themeOverride?: DuaCardTheme,
): string {
  const isLandscape = targetWidth > targetHeight;
  const activeTheme: DuaCardTheme = dua.theme || themeOverride || "cream";
  const activePosition: DuaCardPosition = dua.position || "center";
  const activeStyle: DuaCardStyle = dua.cardStyle || "classic";

  // Color palette per theme
  let cardBg = "#FAF6ED"; // Warm ivory / Cream
  let cardBorder = "#E2D3B3"; // Soft gold hairline
  let cardHeaderBg = "#F0E4CA";
  let cardHeaderBorder = "#D4BE92";
  let cardBadgeText = "#8C682A";
  let dividerColor = "#D4BE92";
  let hindiColor = "#1E293B"; // Deep slate / Charcoal
  let arabicColor = "#064E3B"; // Rich Islamic deep emerald
  let referenceColor = "#64748B"; // Muted slate
  let bgScrimOpacity = 0.45;
  let isDarkTheme = false;

  if (activeTheme === "white") {
    cardBg = "#FFFFFF";
    cardBorder = "#E5E7EB";
    cardHeaderBg = "#F9FAFB";
    cardHeaderBorder = "#E5E7EB";
    cardBadgeText = "#B45309"; // Warm amber
    dividerColor = "#E5E7EB";
    hindiColor = "#111827";
    arabicColor = "#047857"; // Emerald green
    referenceColor = "#6B7280";
  } else if (activeTheme === "light_grey") {
    cardBg = "#F4F6F8";
    cardBorder = "#CBD5E1";
    cardHeaderBg = "#E2E8F0";
    cardHeaderBorder = "#CBD5E1";
    cardBadgeText = "#1E293B";
    dividerColor = "#CBD5E1";
    hindiColor = "#0F172A";
    arabicColor = "#1E3A8A"; // Deep royal navy
    referenceColor = "#64748B";
  } else if (activeTheme === "emerald_dark") {
    isDarkTheme = true;
    cardBg = "#06281E"; // Deep Islamic forest emerald
    cardBorder = "#D4AF37"; // Shimmering gold
    cardHeaderBg = "#0B3D2E";
    cardHeaderBorder = "#E5C158";
    cardBadgeText = "#FDE68A";
    dividerColor = "#D4AF37";
    hindiColor = "#F8FAFC"; // Crisp pure white
    arabicColor = "#FCD34D"; // Glowing gold Arabic
    referenceColor = "#94A3B8";
    bgScrimOpacity = 0.6;
  } else if (activeTheme === "midnight_gold") {
    isDarkTheme = true;
    cardBg = "#0F1117"; // Ultra-dark obsidian
    cardBorder = "#F59E0B"; // Bright gold hairline
    cardHeaderBg = "#1E2230";
    cardHeaderBorder = "#FBBF24";
    cardBadgeText = "#FDE68A";
    dividerColor = "#F59E0B";
    hindiColor = "#FFFFFF";
    arabicColor = "#FBBF24"; // Bright amber gold
    referenceColor = "#9CA3AF";
    bgScrimOpacity = 0.65;
  }

  // Adjust bg for minimal_glass style
  if (activeStyle === "minimal_glass") {
    cardBg = isDarkTheme ? "rgba(15, 23, 42, 0.82)" : "rgba(255, 255, 255, 0.88)";
  }

  const maxCharsHindi = isLandscape ? 52 : (activeStyle === "full_banner" ? 44 : 38);
  const maxCharsArabic = isLandscape ? 48 : (activeStyle === "full_banner" ? 40 : 34);

  const hindiLines = wrapLines(dua.hindi || "", maxCharsHindi).slice(0, 4);
  const arabicLines = wrapLines(dua.arabic || "", maxCharsArabic).slice(0, 4);

  const hindiLineHeight = isLandscape ? 52 : 60;
  const arabicLineHeight = isLandscape ? 64 : 74;

  const hindiFontSize = hindiLines.length > 2 ? (isLandscape ? 34 : 38) : (isLandscape ? 38 : 44);
  const arabicFontSize = arabicLines.length > 2 ? (isLandscape ? 42 : 48) : (isLandscape ? 48 : 56);

  // Card dimensions - expanded for wider presentation
  let cardWidth = isLandscape ? Math.min(targetWidth - 200, 1160) : Math.min(targetWidth - 60, 1020);
  let cardX = (targetWidth - cardWidth) / 2;
  let cardRadius = activeStyle === "floating_pill" ? 40 : activeStyle === "full_banner" ? 0 : 28;

  if (activeStyle === "full_banner") {
    cardWidth = targetWidth;
    cardX = 0;
  }

  const rawTitle = dua.title ? dua.title.toUpperCase() : "DUA • दुआ • دعاء";
  const headerBadgeHeight = isLandscape ? 52 : 62;
  const headerFontSize = isLandscape ? 21 : 25;
  const headerBadgeWidth = isLandscape
    ? Math.max(300, Math.min(cardWidth - 80, rawTitle.length * 15 + 80))
    : Math.max(360, Math.min(cardWidth - 60, rawTitle.length * 17 + 90));

  const headerHeight = headerBadgeHeight + (isLandscape ? 12 : 16);
  const hindiBlockHeight = hindiLines.length * hindiLineHeight;
  const arabicBlockHeight = arabicLines.length * arabicLineHeight;
  const footerHeight = dua.reference ? (isLandscape ? 40 : 48) : 20;
  const paddingY = isLandscape ? 36 : 46;

  // Spacing rhythm between blocks: badge -> hindi -> divider -> arabic -> reference.
  // Increased gap between title badge and Hindi Dua for clean, airy breathing space.
  const gapBadgeToHindi = isLandscape ? 55 : 75;
  const gapHindiToDivider = isLandscape ? 28 : 34;
  const gapDividerToArabic = isLandscape ? 46 : 56;
  const gapArabicToReference = isLandscape ? 30 : 38;
  const dividerHeight = gapHindiToDivider + gapDividerToArabic;

  const contentHeight =
    headerHeight +
    gapBadgeToHindi +
    hindiBlockHeight +
    dividerHeight +
    arabicBlockHeight +
    footerHeight +
    paddingY * 2;

  const cardHeight = Math.min(targetHeight - 120, Math.max(isLandscape ? 480 : 620, contentHeight));

  // Vertical positioning
  let cardY = (targetHeight - cardHeight) / 2; // default center
  if (activePosition === "top") {
    cardY = isLandscape ? 50 : 160;
  } else if (activePosition === "bottom") {
    cardY = targetHeight - cardHeight - (isLandscape ? 60 : 180);
  }

  const centerX = targetWidth / 2;

  // Header positioning
  const headerBadgeX = centerX - headerBadgeWidth / 2;
  const headerBadgeY = cardY + paddingY;

  // Hindi text positioning (Top)
  const hindiStartY = headerBadgeY + headerBadgeHeight + gapBadgeToHindi;
  const hindiTspans = hindiLines
    .map((line, idx) => {
      const y = hindiStartY + idx * hindiLineHeight;
      return `<tspan x="${centerX}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("\n");

  // Divider positioning - wider decorative span
  const dividerY = hindiStartY + hindiBlockHeight + gapHindiToDivider;
  const dividerWidth = Math.min(cardWidth - (isLandscape ? 140 : 90), 860);
  const dividerX = centerX - dividerWidth / 2;

  // Arabic text positioning (Below Hindi)
  const arabicStartY = dividerY + gapDividerToArabic;
  const arabicTspans = arabicLines
    .map((line, idx) => {
      const y = arabicStartY + idx * arabicLineHeight;
      return `<tspan x="${centerX}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("\n");

  // Reference footer positioning
  const referenceY = arabicStartY + arabicBlockHeight + gapArabicToReference;

  return `
  <svg width="100%" height="100%" viewBox="0 0 ${targetWidth} ${targetHeight}" preserveAspectRatio="xMidYMid meet" style="display: block; max-width: 100%; height: auto;" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Premium Multi-layer Drop Shadow for Dua Card -->
      <filter id="duaCardShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="16" stdDeviation="28" flood-color="#000000" flood-opacity="0.65" />
        <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#000000" flood-opacity="0.40" />
      </filter>

      <filter id="badgeShadow" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.18" />
      </filter>

      <linearGradient id="goldFiligree" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${dividerColor}" stop-opacity="0.1" />
        <stop offset="50%" stop-color="${dividerColor}" stop-opacity="0.95" />
        <stop offset="100%" stop-color="${dividerColor}" stop-opacity="0.1" />
      </linearGradient>
    </defs>

    <!-- Ambient Dimming Scrim Background behind Dua Card for Focus -->
    <rect width="${targetWidth}" height="${targetHeight}" fill="#000000" fill-opacity="${bgScrimOpacity}" />

    <!-- Main Dua Card Container -->
    <g filter="url(#duaCardShadow)">
      <rect
        x="${cardX}"
        y="${cardY}"
        width="${cardWidth}"
        height="${cardHeight}"
        rx="${cardRadius}"
        ry="${cardRadius}"
        fill="${cardBg}"
        stroke="${cardBorder}"
        stroke-width="${activeStyle === 'full_banner' ? '0' : '3'}"
      />
      ${
        activeStyle === "classic" || activeStyle === "floating_pill"
          ? `
      <!-- Inner hairline accent border for luxurious Islamic aesthetic -->
      <rect
        x="${cardX + 8}"
        y="${cardY + 8}"
        width="${cardWidth - 16}"
        height="${cardHeight - 16}"
        rx="${Math.max(12, cardRadius - 6)}"
        ry="${Math.max(12, cardRadius - 6)}"
        fill="none"
        stroke="${cardBorder}"
        stroke-width="1"
        stroke-opacity="0.6"
      />
      `
          : ""
      }
    </g>

    <!-- Top Spiritual Badge / Header -->
    <g filter="url(#badgeShadow)">
      <rect
        x="${headerBadgeX}"
        y="${headerBadgeY}"
        width="${headerBadgeWidth}"
        height="${headerBadgeHeight}"
        rx="${headerBadgeHeight / 2}"
        ry="${headerBadgeHeight / 2}"
        fill="${cardHeaderBg}"
        stroke="${cardHeaderBorder}"
        stroke-width="1.5"
      />
      <text
        x="${centerX}"
        y="${headerBadgeY + (isLandscape ? 33 : 40)}"
        font-family="${FONT_HEADER}"
        font-size="${headerFontSize}"
        font-weight="800"
        letter-spacing="1.2"
        text-anchor="middle"
        fill="${cardBadgeText}"
      >
        🤲 ${escapeXml(rawTitle)}
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
