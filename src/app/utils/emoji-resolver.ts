import fs from "fs";
import path from "path";

export type EmojiStyle = "fluent" | "apple" | "twitter";

/**
 * Keyword → emoji rules, checked top to bottom (first match wins).
 * Keywords match WHOLE words only ("रात" won't match inside "ताबरात").
 * A trailing "*" matches any word starting with it ("khush*" → khushi, khushiyan).
 */
export const KEYWORD_EMOJI_RULES: Array<{ keywords: string[]; emoji: string }> = [
  // Heartbreak (before Love, so "दिल तोड़" isn't caught by "दिल")
  { keywords: ["दिल दुखाया", "दिल तोड़*", "दिल टूट*", "dil dukhaya", "dil tod*", "dil toot*", "heartbreak*", "broken heart", "चोट", "wound*"], emoji: "💔" },
  // Holy Name / Zikr / Tasbih
  { keywords: ["ज़िक्र", "जिक्र", "zikr", "तस्बीह", "tasbih", "अल्लाह का नाम", "allah ka naam"], emoji: "📿" },
  // Secret / Key
  { keywords: ["रहस्य", "राज़", "secret*", "चाबी", "key", "keys"], emoji: "🔑" },
  // Protection / Refuge (before Dua & Gift, so "पनाह मांगे" is protection)
  { keywords: ["पनाह", "हिफ़ाज़त", "हिफाज़त", "हिफाजत", "panah", "hifazat", "protection", "protect*", "refuge"], emoji: "🛡️" },
  // Dua / Supplication / Prayer / Namaz
  { keywords: ["दुआ*", "dua", "duas", "duaon", "duayein", "नमाज़*", "नमाज*", "namaz", "प्रार्थना", "prayer*", "pray", "praying", "सजदा", "sajda"], emoji: "🤲" },
  // Divine Acceptance
  { keywords: ["कबूल", "क़बूल", "qabool", "qubool"], emoji: "✅" },
  // Gift / Atta / Reward
  { keywords: ["अता", "तोहफा", "तोहफ़ा", "tohfa", "gift*", "इनाम", "inaam", "बख्शीश", "bakhshish", "reward*"], emoji: "🎁" },
  // Wonder / Praise / SubhanAllah / Miracle
  { keywords: ["सुभान*", "subhan*", "तारीफ*", "tareef", "चमत्कार", "miracle*", "अद्भुत", "wonder*", "awe"], emoji: "💫" },
  // Love / Beloved / Sweetness
  { keywords: ["प्यार*", "pyar*", "मुहब्बत", "मोहब्बत", "mohabbat", "muhabbat", "इश्क़", "इश्क", "ishq", "love*", "sweet", "beautiful", "दिल", "heart", "dil"], emoji: "❤️" },
  // Tears / Crying / Sadness
  { keywords: ["रोना", "रोया", "रोते", "रोती", "रोने", "rona", "roya", "आंसू", "आँसू", "aansu", "tears", "cry", "crying", "cried", "ग़म", "गम", "gham", "दर्द", "dard", "pain", "sad", "sadness"], emoji: "😢" },
  // Forgiveness / Mercy / Tawbah
  { keywords: ["माफ़*", "माफ*", "maaf*", "मग़फ़िरत", "मगफिरत", "maghfirat", "तौबा", "tawbah", "tauba", "रहमत", "rahmat", "mercy", "forgiv*"], emoji: "🕊️" },
  // Time / Urgency / Delay
  { keywords: ["वक़्त", "वक्त", "waqt", "समय", "samay", "time", "सेकंड", "second*", "देर", "der", "delay", "रुको", "ruko", "wait", "घड़ी", "घडी"], emoji: "⏳" },
  // Actions come before subjects: "सांप ने हमला किया" → ⚠️, "दुश्मन पर गालिब" → 🏆.
  // Attack / Harm / Warning / Sin
  { keywords: ["हमला", "hamla", "attack*", "नुकसान", "नुक़सान", "nuksan", "nuqsan", "कसम", "क़सम", "qasam", "ख़तरा", "खतरा", "khatra", "चेतावनी", "warning", "गुनाह*", "gunah", "sin", "sins", "अज़ाब", "अजाब", "azab", "danger*", "beware"], emoji: "⚠️" },
  // Fear
  { keywords: ["डर", "डरावना", "डरावने", "डरना", "darr", "darawna", "fear*", "scary", "afraid"], emoji: "😨" },
  // Victory
  { keywords: ["गालिब", "ग़ालिब", "ghalib", "जीत*", "jeet*", "फ़तह", "फतह", "fateh", "victory", "win", "winner"], emoji: "🏆" },
  // Snake
  { keywords: ["सांप", "साँप", "नाग", "saanp", "sanp", "snake*"], emoji: "🐍" },
  // Dream
  { keywords: ["ख्वाब*", "ख़्वाब*", "सपना", "सपने", "सपनों", "khwab*", "khwaab*", "sapna", "sapne", "dream*"], emoji: "💭" },
  // Enemy / Envy
  { keywords: ["दुश्मन*", "हसद", "dushman*", "hasad", "enemy", "enemies", "envy"], emoji: "😠" },
  // Hellfire / Fire / Burning
  { keywords: ["आग", "aag", "जहन्नम", "jahannam", "hell", "hellfire", "fire", "flame*", "burn*"], emoji: "🔥" },
  // Death / Grave / Hereafter
  { keywords: ["मौत", "maut", "death", "क़ब्र", "कब्र", "qabar", "qabr", "grave", "जनाज़ा", "जनाजा", "janaza"], emoji: "🪦" },
  // Wisdom / Insight / Idea
  { keywords: ["सोच", "soch", "अक्ल", "अक़्ल", "aql", "wisdom", "idea", "ज्ञान", "सबक", "सबक़", "sabak", "lesson"], emoji: "💡" },
  // Quran / Hadith / Sacred Book
  { keywords: ["हदीस", "hadith", "क़ुरान", "कुरान", "कुरआन", "quran", "किताब", "kitab", "book", "आयत", "ayat"], emoji: "📖" },
  // Justice / Balance / Scales
  { keywords: ["इंसाफ", "इंसाफ़", "insaaf", "मीज़ान", "मीजान", "mizan", "justice", "balance", "scale"], emoji: "⚖️" },
  // Share / Spread the message
  { keywords: ["शेयर", "share", "forward"], emoji: "📤" },
  // Kaaba / Ibadat / Hajj / Umrah
  { keywords: ["काबा", "kaaba", "इबादत", "ibadat", "हज", "हज्ज", "hajj", "उमरा", "umrah", "मक्का", "makkah", "makka", "mecca"], emoji: "🕋" },
  // Mosque
  { keywords: ["मस्जिद", "masjid", "mosque"], emoji: "🕌" },
  // Gratitude / Shukr
  { keywords: ["शुक्र*", "shukr*", "अलहम्दुलिल्लाह", "alhamdulillah", "thanks", "thank you", "gratitude", "grateful", "धन्यवाद"], emoji: "🤲" },
  // Khushi / Tasalli / Happiness
  { keywords: ["खुश*", "khush*", "तसल्ली", "tasalli", "happy", "happiness", "smile*", "मुस्कुरा*", "muskura*"], emoji: "😊" },
  // Narmi / Gentleness / Kindness
  { keywords: ["नरमी", "नरम", "narmi", "naram", "मेहरबानी", "mehrbani", "अख़लाक़", "अखलाक", "akhlaq", "gentle", "kindness"], emoji: "🌸" },
  // Barkat / Madad / Karishma
  { keywords: ["बरकत", "barkat", "मदद", "madad", "करिश्मा", "karishma", "blessing*"], emoji: "💫" },
  // Sukoon / Pakeezgi / Sabr / Peace
  { keywords: ["सुकून", "sukoon", "पाकीज़गी", "पाकीजगी", "pakeezgi", "सब्र", "sabr", "इत्मीनान", "itminan", "peace", "calm"], emoji: "🤍" },
  // Chaand / Ramzan / Eid / Raat
  { keywords: ["चाँद", "चांद", "chaand", "chand", "रमज़ान", "रमजान", "ramzan", "ramadan", "ईद", "eid", "रात", "raat"], emoji: "🌙" },
  // Noor
  { keywords: ["नूर", "noor"], emoji: "🌟" },
  // Roshni / Subah
  { keywords: ["रोशनी", "roshni", "सुबह", "subah", "sunrise"], emoji: "☀️" },
  // General Divine / Allah (checked last so specific actions take precedence!)
  { keywords: ["अल्लाह*", "allah", "खुदा", "ख़ुदा", "khuda", "रब", "rabb", "भगवान", "god"], emoji: "✨" },
];

// Devanagari vowel signs/nukta are marks (\p{M}), so they count as part of a
// word: "रो" won't match inside "करो", "हज" won't match inside "हज़ार".
const WORD_CHAR = "[\\p{L}\\p{M}\\p{N}]";

function compileKeyword(keyword: string): RegExp {
  const isPrefix = keyword.endsWith("*");
  const body = (isPrefix ? keyword.slice(0, -1) : keyword).trim().toLowerCase().normalize("NFC");
  const escaped = body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?<!${WORD_CHAR})${escaped}${isPrefix ? "" : `(?!${WORD_CHAR})`}`, "u");
}

const COMPILED_RULES = KEYWORD_EMOJI_RULES.map((rule) => ({
  emoji: rule.emoji,
  patterns: rule.keywords.map(compileKeyword),
}));

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

  // NFC keeps nukta letters (ज़ vs ज + ़) consistent between text and keywords.
  const normalized = text.toLowerCase().normalize("NFC");

  // 2. Prioritized whole-word keyword matching
  for (const rule of COMPILED_RULES) {
    if (rule.patterns.some((re) => re.test(normalized))) {
      return rule.emoji;
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
