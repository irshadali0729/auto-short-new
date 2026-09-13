import fs from "fs";
import path from "path";

export type EmojiStyle = "fluent" | "apple" | "twitter";

export const KEYWORD_EMOJI_RULES: Array<{ keywords: string[]; emoji: string }> = [
  // Holy Name / Zikr / Tasbih / Key
  { keywords: ["नाम", "naam", "name", "ज़िक्र", "zikr", "तस्बीह", "tasbih", "ism", "रहस्य", "secret", "चाबी", "key"], emoji: "📿" },
  // Dua / Supplication / Prayer / Namaz
  { keywords: ["दुआ", "दुआएं", "दुआओं", "dua", "duayein", "नमाज़", "नमाज", "namaz", "प्रार्थना", "prayer", "pray", "सजदा", "sajda"], emoji: "🤲" },
  // Divine Acceptance / Gift / Atta / Reward / Bounty
  { keywords: ["कबूल", "क़बूल", "qabool", "अता", "ata", "मांगा", "manga", "मांग", "तोहफा", "tohfa", "gift", "इनाम", "inaam", "बख्शीश", "bakhshish", "grant", "reward"], emoji: "🎁" },
  // Wonder / Praise / SubhanAllah / Miracle
  { keywords: ["सुभान", "सुभानल्लाह", "subhan", "subhanallah", "तारीफ", "tareef", "चमत्कार", "miracle", "अद्भुत", "wonder", "awe"], emoji: "💫" },
  // Love / Beloved / Sweetness / Pyari
  { keywords: ["प्यारी", "प्यारा", "pyari", "pyara", "मुहब्बत", "mohabbat", "इश्क़", "ishq", "love", "sweet", "beautiful", "दिल", "heart", "dil"], emoji: "❤️" },
  // Heartbreak / Pain / Broken trust
  { keywords: ["दिल दुखाया", "दिल तोड़", "dil dukhaya", "heartbreak", "broken", "चोट", "wound"], emoji: "💔" },
  // Tears / Crying / Sadness
  { keywords: ["रो", "रोना", "रोना धोना", "rona", "आंसू", "aansu", "tears", "cry", "crying", "गम", "gham", "दर्द", "dard", "pain", "sad"], emoji: "😢" },
  // Forgiveness / Mercy / Tawbah
  { keywords: ["माफ़", "माफ़ी", "maaf", "maafi", "मग़फ़िरत", "maghfirat", "तौबा", "tawbah", "रहमत", "rahmat", "mercy", "forgiveness"], emoji: "🕊️" },
  // Time / Urgency / Delay / 10 seconds
  { keywords: ["वक़्त", "वक्त", "waqt", "समय", "samay", "time", "सेकंड", "second", "देर", "der", "delay", "रुको", "ruko", "stop", "wait", "घड़ी"], emoji: "⏳" },
  // Warning / Danger / Fear
  { keywords: ["कसम", "क़सम", "qasam", "ख़तरा", "खतरा", "khatra", "चेतावनी", "warning", "गुनाह", "gunah", "sin", "अज़ाब", "azab", "danger", "beware"], emoji: "⚠️" },
  // Hellfire / Fire / Burning
  { keywords: ["आग", "aag", "जहन्नम", "jahannam", "hell", "fire", "flame", "burn"], emoji: "🔥" },
  // Death / Grave / Hereafter
  { keywords: ["मौत", "maut", "death", "क़ब्र", "कब्र", "qabar", "grave", "जनाज़ा", "janaza"], emoji: "🪦" },
  // Wisdom / Insight / Idea
  { keywords: ["सोच", "soch", "समझ", "samajh", "wisdom", "idea", "अक्ल", "aql", "ज्ञान"], emoji: "💡" },
  // Quran / Hadith / Sacred Book
  { keywords: ["हदीस", "hadith", "क़ुरान", "कुरान", "quran", "किताब", "kitab", "book", "आयत", "ayat"], emoji: "📖" },
  // Justice / Balance / Scales
  { keywords: ["इंसाफ", "insaaf", "मीज़ान", "mizan", "justice", "balance", "तोल", "scale"], emoji: "⚖️" },
  // Mosque / Holy place / Kaaba
  { keywords: ["मस्जिद", "masjid", "mosque", "काबा", "kaaba", "haram"], emoji: "🕌" },
  // Gratitude / Shukr
  { keywords: ["शुक्र", "shukr", "thanks", "gratitude", "धन्यवाद"], emoji: "🙏" },
  // General Divine Light / Noor / Allah (checked last so specific actions take precedence!)
  { keywords: ["अल्लाह", "allah", "खुदा", "ख़ुदा", "khuda", "रब", "rabb", "भगवान", "god", "नूर", "noor", "roshni", "light"], emoji: "✨" },
];

/**
 * Normalizes an emoji to standard hex representation for file caching and API lookups.
 */
export function emojiToHex(emoji: string): string {
  if (!emoji) return "";
  return Array.from(emoji.trim())
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter(Boolean)
    .filter((hex) => hex !== "fe0f") // strip variation selector-16 for consistent cache keys
    .join("-")
    .toLowerCase();
}

/**
 * Extracts or infers an emoji from a keyword or descriptive sentence in any language (Hindi, Urdu, English).
 */
export function resolveEmojiForText(text: string): string | null {
  if (!text) return null;

  // 1. Check if string already contains a Unicode emoji
  const emojiMatch = text.match(
    /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u,
  );
  if (emojiMatch && emojiMatch[0]) {
    return emojiMatch[0];
  }

  const normalized = text.toLowerCase();

  // 2. Prioritized rule-based phrase and keyword matching
  for (const rule of KEYWORD_EMOJI_RULES) {
    for (const kw of rule.keywords) {
      if (normalized.includes(kw.toLowerCase())) {
        return rule.emoji;
      }
    }
  }

  return null;
}

/**
 * Resolves an emoji character to a high-resolution Base64 PNG Data URI.
 * Checks local disk cache first, falling back to EmojiCDN (https://emojicdn.elk.sh/{emoji}?style={style}).
 */
export async function resolveEmojiDataUri(
  emojiChar: string,
  style: EmojiStyle = "fluent",
): Promise<string | null> {
  const cleanEmoji = (emojiChar || "").trim();
  if (!cleanEmoji) return null;

  const hexCode = emojiToHex(cleanEmoji);
  if (!hexCode) return null;

  const libraryDir = path.join(process.cwd(), "image-library", "emojis");
  if (!fs.existsSync(libraryDir)) {
    fs.mkdirSync(libraryDir, { recursive: true });
  }

  const cachedFilePath = path.join(libraryDir, `${style}_${hexCode}.png`);

  // 1. Return from disk cache if already present
  if (fs.existsSync(cachedFilePath)) {
    try {
      const buffer = fs.readFileSync(cachedFilePath);
      if (buffer.length > 0) {
        return `data:image/png;base64,${buffer.toString("base64")}`;
      }
    } catch (err) {
      console.warn(`Error reading cached emoji ${cachedFilePath}:`, err);
    }
  }

  // 2. Fetch from EmojiCDN
  try {
    const cdnUrl = `https://emojicdn.elk.sh/${encodeURIComponent(cleanEmoji)}?style=${style}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(cdnUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length > 0) {
        // Save to disk cache
        try {
          fs.writeFileSync(cachedFilePath, buffer);
        } catch (writeErr) {
          console.warn(`Failed to write emoji cache for ${hexCode}:`, writeErr);
        }
        return `data:image/png;base64,${buffer.toString("base64")}`;
      }
    } else if (style !== "twitter") {
      // Fallback to twitter style if fluent/apple 404s for this glyph
      const fallbackUrl = `https://emojicdn.elk.sh/${encodeURIComponent(cleanEmoji)}?style=twitter`;
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) {
        const arrayBuffer = await fallbackRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length > 0) {
          try {
            fs.writeFileSync(cachedFilePath, buffer);
          } catch {}
          return `data:image/png;base64,${buffer.toString("base64")}`;
        }
      }
    }
  } catch (fetchErr) {
    console.warn(`Could not fetch emoji ${cleanEmoji} (${hexCode}):`, fetchErr);
  }

  return null;
}
