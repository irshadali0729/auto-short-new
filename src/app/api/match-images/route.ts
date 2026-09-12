import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface GraphicBeat {
  prefixText?: string;
  heroWord?: string;
  suffixText?: string;
  style?: "stacked-kinetic" | "top-hero" | "thought-bubble" | "breakdown-card";
  text?: string;
  accent?: string;
  type?: "impact" | "money" | "result" | "platform";
  start: number;
  end: number;
}

interface CaptionSlice {
  text: string;
  start: number;
  end: number;
}

interface SceneInput {
  keyword: string;
  duration: number;
  visualQuery?: string;
  fallbackQuery?: string;
  moodQuery?: string;
  graphics?: GraphicBeat[];
  captions?: CaptionSlice[];
}

interface MediaSettingsPayload {
  sources?: {
    unsplash?: boolean;
    pixabay?: boolean;
    pexels?: boolean;
    local?: boolean;
  };
  mediaType?: "only_videos" | "only_images" | "both";
  useRelatableVisualSearch?: boolean;
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const ISLAMIC_KEYWORDS = [
  "muslim",
  "islam",
  "quran",
  "mosque",
  "hadith",
  "allah",
  "hijab",
  "salah",
  "kaaba",
  "mecca",
  "madina",
  "dua",
];

function buildIslamicQuery(query: string): string {
  const q = query.trim();
  const lower = q.toLowerCase();
  const hasIslamicContext = ISLAMIC_KEYWORDS.some((k) => lower.includes(k));
  return hasIslamicContext ? q : `${q} Muslim`;
}

function resolveSearchQuery(query: string, isRelatableMode: boolean = false): string {
  const q = query.trim();
  if (!isRelatableMode) {
    return buildIslamicQuery(q);
  }

  const lower = q.toLowerCase();
  const prayerWords = [
    "prayer",
    "prostrating",
    "worship",
    "mosque",
    "dua",
    "quran",
    "salah",
    "kaaba",
    "mecca",
    "medina",
    "masjid"
  ];
  const hasPrayerContext = prayerWords.some((w) => lower.includes(w));
  const hasIslamicContext = ISLAMIC_KEYWORDS.some((k) => lower.includes(k));

  if (hasPrayerContext && !hasIslamicContext) {
    return `${q} Muslim`;
  }

  return q;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const scenes = body.scenes;
    const mediaSettings: MediaSettingsPayload = body.mediaSettings || {};

    if (!scenes || !Array.isArray(scenes)) {
      return NextResponse.json(
        { error: "Scenes list is required." },
        { status: 400 },
      );
    }

    const libraryPath = path.join(process.cwd(), "image-library");
    const pexelsApiKey = process.env.PEXELS_API_KEY || "";
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY || "";
    const pixabayApiKey = process.env.PIXABAY_API_KEY || "";

    if (!fs.existsSync(libraryPath)) {
      fs.mkdirSync(libraryPath, { recursive: true });
    }

    const allFiles = fs.readdirSync(libraryPath);
    const supportedExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".gif",
      ".mp4",
      ".webm",
      ".mov",
    ];
    const availableAssets = allFiles.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return supportedExtensions.includes(ext);
    });

    const mediaFilter = mediaSettings.mediaType || "both";
    const allowPexels =
      !mediaSettings.sources || mediaSettings.sources.pexels !== false;
    const allowUnsplash =
      !mediaSettings.sources || mediaSettings.sources.unsplash !== false;
    const allowPixabay = Boolean(
      mediaSettings.sources?.pixabay !== false && pixabayApiKey,
    );
    const allowLocal =
      !mediaSettings.sources || mediaSettings.sources.local !== false;

    const isRelatableMode = mediaSettings.useRelatableVisualSearch !== false;

    const matchedScenes: Array<{
      keyword: string;
      duration: number;
      image: string;
      isFallback: boolean;
      visualQuery?: string;
      fallbackQuery?: string;
      moodQuery?: string;
      matchedTier?: "visual" | "fallback" | "mood" | "local" | "random" | "legacy";
      matchedQuery?: string;
      graphics?: GraphicBeat[];
      captions?: CaptionSlice[];
    }> = [];

    const usedAssets = new Set<string>();
    const usedPexelsPhotoIds = new Set<number>();
    const usedPexelsVideoIds = new Set<number>();
    const usedUnsplashIds = new Set<string>();
    const usedPixabayPhotoIds = new Set<number>();
    const usedPixabayVideoIds = new Set<number>();

    for (let sceneIdx = 0; sceneIdx < scenes.length; sceneIdx++) {
      const scene: SceneInput = scenes[sceneIdx];
      const { keyword, duration, graphics, captions, visualQuery, fallbackQuery, moodQuery } = scene;
      const kw = keyword ? keyword.trim() : "";

      // Determine preference for this scene: video vs image
      let preferVideo = false;
      if (mediaFilter === "only_videos") {
        preferVideo = true;
      } else if (mediaFilter === "only_images") {
        preferVideo = false;
      } else {
        // "both": alternate videos and images across scenes
        preferVideo = sceneIdx % 2 === 0;
      }

      if (isRelatableMode) {
        // ==========================================
        // RELATABLE VISUAL SEARCH & MULTI-TIER CASCADE
        // ==========================================
        const q1 = (visualQuery || kw).trim();
        const q2 = (fallbackQuery || "").trim();
        const q3 = (moodQuery || "").trim();

        let chosenAsset: string | null = null;
        let matchedTier: "visual" | "fallback" | "mood" | "local" | "random" = "random";
        let matchedQuery = q1;

        // Tier 1: Specific photogenic camera shot
        if (q1) {
          chosenAsset = await fetchMediaForQuery(
            q1,
            preferVideo,
            mediaFilter,
            true,
            pexelsApiKey,
            unsplashKey,
            pixabayApiKey,
            allowPexels,
            allowUnsplash,
            allowPixabay,
            usedPexelsPhotoIds,
            usedPexelsVideoIds,
            usedUnsplashIds,
            usedPixabayPhotoIds,
            usedPixabayVideoIds,
          );
          if (chosenAsset) {
            matchedTier = "visual";
            matchedQuery = q1;
          }
        }

        // Tier 2: Secondary physical alternative shot
        if (!chosenAsset && q2) {
          chosenAsset = await fetchMediaForQuery(
            q2,
            preferVideo,
            mediaFilter,
            true,
            pexelsApiKey,
            unsplashKey,
            pixabayApiKey,
            allowPexels,
            allowUnsplash,
            allowPixabay,
            usedPexelsPhotoIds,
            usedPexelsVideoIds,
            usedUnsplashIds,
            usedPixabayPhotoIds,
            usedPixabayVideoIds,
          );
          if (chosenAsset) {
            matchedTier = "fallback";
            matchedQuery = q2;
          }
        }

        // Tier 3: Universal atmospheric / mood shot
        if (!chosenAsset && q3) {
          chosenAsset = await fetchMediaForQuery(
            q3,
            preferVideo,
            mediaFilter,
            true,
            pexelsApiKey,
            unsplashKey,
            pixabayApiKey,
            allowPexels,
            allowUnsplash,
            allowPixabay,
            usedPexelsPhotoIds,
            usedPexelsVideoIds,
            usedUnsplashIds,
            usedPixabayPhotoIds,
            usedPixabayVideoIds,
          );
          if (chosenAsset) {
            matchedTier = "mood";
            matchedQuery = q3;
          }
        }

        // Tier 4: Smart tokenized search against local image library
        if (!chosenAsset && allowLocal) {
          const localMatch = matchSmartLocalAssets(
            availableAssets,
            [q1, q2, q3, kw].filter(Boolean),
            usedAssets,
            preferVideo,
            mediaFilter === "only_videos",
          );
          if (localMatch) {
            chosenAsset = localMatch;
            matchedTier = "local";
            matchedQuery = "Local Library Match";
          }
        }

        // Tier 5: Random unused fallback asset
        if (!chosenAsset) {
          chosenAsset = getFallbackAsset(
            availableAssets,
            usedAssets,
            preferVideo,
          );
          matchedTier = "random";
          matchedQuery = "Fallback Asset";
        }

        matchedScenes.push({
          keyword,
          duration,
          image: chosenAsset,
          isFallback: matchedTier === "random",
          visualQuery,
          fallbackQuery,
          moodQuery,
          matchedTier,
          matchedQuery,
          graphics: Array.isArray(graphics) ? graphics : undefined,
          captions: Array.isArray(captions) ? captions : undefined,
        });
        usedAssets.add(chosenAsset);
      } else {
        // ==========================================
        // LEGACY SINGLE-KEYWORD MATCHING IMPLEMENTATION
        // ==========================================
        if (!kw) {
          const fallback = getFallbackAsset(availableAssets, usedAssets, preferVideo);
          matchedScenes.push({
            keyword,
            duration,
            image: fallback,
            isFallback: true,
            matchedTier: "legacy",
            matchedQuery: "Fallback",
            graphics: Array.isArray(graphics) ? graphics : undefined,
            captions: Array.isArray(captions) ? captions : undefined,
          });
          usedAssets.add(fallback);
          continue;
        }

        let foundAsset: string | null = null;

        // 1. Try preferred media type first
        if (preferVideo) {
          foundAsset = await fetchVideoFromProviders(
            kw,
            pexelsApiKey,
            pixabayApiKey,
            allowPexels,
            allowPixabay,
            usedPexelsVideoIds,
            usedPixabayVideoIds,
            false,
          );
        } else {
          foundAsset = await fetchPhotoFromProviders(
            kw,
            pexelsApiKey,
            unsplashKey,
            pixabayApiKey,
            allowPexels,
            allowUnsplash,
            allowPixabay,
            usedPexelsPhotoIds,
            usedUnsplashIds,
            usedPixabayPhotoIds,
            false,
          );
        }

        // 2. If 'both' mode and preferred media type failed, try opposite media type
        if (!foundAsset && mediaFilter === "both") {
          if (preferVideo) {
            foundAsset = await fetchPhotoFromProviders(
              kw,
              pexelsApiKey,
              unsplashKey,
              pixabayApiKey,
              allowPexels,
              allowUnsplash,
              allowPixabay,
              usedPexelsPhotoIds,
              usedUnsplashIds,
              usedPixabayPhotoIds,
              false,
            );
          } else {
            foundAsset = await fetchVideoFromProviders(
              kw,
              pexelsApiKey,
              pixabayApiKey,
              allowPexels,
              allowPixabay,
              usedPexelsVideoIds,
              usedPixabayVideoIds,
              false,
            );
          }
        }

        // If remote provider found asset, record and continue
        if (foundAsset) {
          matchedScenes.push({
            keyword,
            duration,
            image: foundAsset,
            isFallback: false,
            matchedTier: "legacy",
            matchedQuery: kw,
            graphics: Array.isArray(graphics) ? graphics : undefined,
            captions: Array.isArray(captions) ? captions : undefined,
          });
          usedAssets.add(foundAsset);
          continue;
        }

        // 3. Try matching local assets
        if (allowLocal) {
          const localMatches = matchLocalAssets(
            availableAssets,
            kw,
            usedAssets,
            preferVideo,
            mediaFilter === "only_videos",
          );

          if (localMatches.length > 0) {
            const chosen =
              localMatches[Math.floor(Math.random() * localMatches.length)];
            matchedScenes.push({
              keyword,
              duration,
              image: chosen,
              isFallback: false,
              matchedTier: "legacy",
              matchedQuery: kw,
              graphics: Array.isArray(graphics) ? graphics : undefined,
              captions: Array.isArray(captions) ? captions : undefined,
            });
            usedAssets.add(chosen);
            continue;
          }
        }

        // 4. Fallback to random unused local asset
        const fallback = getFallbackAsset(
          availableAssets,
          usedAssets,
          preferVideo,
        );
        matchedScenes.push({
          keyword,
          duration,
          image: fallback,
          isFallback: true,
          matchedTier: "legacy",
          matchedQuery: "Fallback",
          graphics: Array.isArray(graphics) ? graphics : undefined,
          captions: Array.isArray(captions) ? captions : undefined,
        });
        usedAssets.add(fallback);
      }
    }

    return NextResponse.json({ matches: matchedScenes });
  } catch (error: unknown) {
    console.error("Error matching media assets:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// ==========================================
// Provider Fetching Orchestrators
// ==========================================

async function fetchMediaForQuery(
  query: string,
  preferVideo: boolean,
  mediaFilter: "only_videos" | "only_images" | "both",
  isRelatableMode: boolean,
  pexelsApiKey: string,
  unsplashKey: string,
  pixabayApiKey: string,
  allowPexels: boolean,
  allowUnsplash: boolean,
  allowPixabay: boolean,
  usedPexelsPhotoIds: Set<number>,
  usedPexelsVideoIds: Set<number>,
  usedUnsplashIds: Set<string>,
  usedPixabayPhotoIds: Set<number>,
  usedPixabayVideoIds: Set<number>,
): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;

  let foundAsset: string | null = null;

  if (preferVideo) {
    foundAsset = await fetchVideoFromProviders(
      q,
      pexelsApiKey,
      pixabayApiKey,
      allowPexels,
      allowPixabay,
      usedPexelsVideoIds,
      usedPixabayVideoIds,
      isRelatableMode,
    );
  } else {
    foundAsset = await fetchPhotoFromProviders(
      q,
      pexelsApiKey,
      unsplashKey,
      pixabayApiKey,
      allowPexels,
      allowUnsplash,
      allowPixabay,
      usedPexelsPhotoIds,
      usedUnsplashIds,
      usedPixabayPhotoIds,
      isRelatableMode,
    );
  }

  if (!foundAsset && mediaFilter === "both") {
    if (preferVideo) {
      foundAsset = await fetchPhotoFromProviders(
        q,
        pexelsApiKey,
        unsplashKey,
        pixabayApiKey,
        allowPexels,
        allowUnsplash,
        allowPixabay,
        usedPexelsPhotoIds,
        usedUnsplashIds,
        usedPixabayPhotoIds,
        isRelatableMode,
      );
    } else {
      foundAsset = await fetchVideoFromProviders(
        q,
        pexelsApiKey,
        pixabayApiKey,
        allowPexels,
        allowPixabay,
        usedPexelsVideoIds,
        usedPixabayVideoIds,
        isRelatableMode,
      );
    }
  }

  return foundAsset;
}

async function fetchVideoFromProviders(
  keyword: string,
  pexelsApiKey: string,
  pixabayApiKey: string,
  allowPexels: boolean,
  allowPixabay: boolean,
  usedPexelsVideoIds: Set<number>,
  usedPixabayVideoIds: Set<number>,
  isRelatableMode: boolean = false,
): Promise<string | null> {
  const videoProviders: Array<"pexels_video" | "pixabay_video"> = [];
  if (pexelsApiKey && allowPexels) videoProviders.push("pexels_video");
  if (pixabayApiKey && allowPixabay) videoProviders.push("pixabay_video");

  shuffleArray(videoProviders);

  for (const provider of videoProviders) {
    if (provider === "pexels_video") {
      const vid = await getPexelsVideo(
        keyword,
        pexelsApiKey,
        usedPexelsVideoIds,
        isRelatableMode,
      );
      if (vid) return vid;
    } else if (provider === "pixabay_video") {
      const vid = await getPixabayVideo(
        keyword,
        pixabayApiKey,
        usedPixabayVideoIds,
        isRelatableMode,
      );
      if (vid) return vid;
    }
  }

  return null;
}

async function fetchPhotoFromProviders(
  keyword: string,
  pexelsApiKey: string,
  unsplashKey: string,
  pixabayApiKey: string,
  allowPexels: boolean,
  allowUnsplash: boolean,
  allowPixabay: boolean,
  usedPexelsPhotoIds: Set<number>,
  usedUnsplashIds: Set<string>,
  usedPixabayPhotoIds: Set<number>,
  isRelatableMode: boolean = false,
): Promise<string | null> {
  const photoProviders: Array<"pexels_photo" | "unsplash_photo" | "pixabay_photo"> = [];
  if (pexelsApiKey && allowPexels) photoProviders.push("pexels_photo");
  if (unsplashKey && allowUnsplash) photoProviders.push("unsplash_photo");
  if (pixabayApiKey && allowPixabay) photoProviders.push("pixabay_photo");

  shuffleArray(photoProviders);

  for (const provider of photoProviders) {
    if (provider === "pexels_photo") {
      const photo = await getPexelsPhoto(
        keyword,
        pexelsApiKey,
        usedPexelsPhotoIds,
        isRelatableMode,
      );
      if (photo) return photo;
    } else if (provider === "unsplash_photo") {
      const photo = await getUnsplashPhoto(
        keyword,
        unsplashKey,
        usedUnsplashIds,
        isRelatableMode,
      );
      if (photo) return photo;
    } else if (provider === "pixabay_photo") {
      const photo = await getPixabayPhoto(
        keyword,
        pixabayApiKey,
        usedPixabayPhotoIds,
        isRelatableMode,
      );
      if (photo) return photo;
    }
  }

  return null;
}

// ==========================================
// Local Assets Helpers
// ==========================================

function isVideoFile(filename: string): boolean {
  return /\.(mp4|webm|mov)$/i.test(filename);
}

function matchLocalAssets(
  availableAssets: string[],
  keyword: string,
  usedAssets: Set<string>,
  preferVideo: boolean,
  onlyVideos: boolean,
): string[] {
  const kw = keyword.toLowerCase();
  let candidatePool = availableAssets.filter((a) => !usedAssets.has(a));
  if (candidatePool.length === 0) candidatePool = availableAssets;

  if (onlyVideos) {
    candidatePool = candidatePool.filter(isVideoFile);
  } else if (preferVideo) {
    const videoMatches = candidatePool.filter(isVideoFile);
    if (videoMatches.length > 0) candidatePool = videoMatches;
  }

  let matches = candidatePool.filter((img) =>
    img.toLowerCase().includes(kw),
  );

  if (matches.length === 0) {
    const words = kw.split(/\s+/).filter((w) => w.length > 2);
    for (const word of words) {
      matches = candidatePool.filter((img) =>
        img.toLowerCase().includes(word),
      );
      if (matches.length > 0) break;
    }
  }

  return matches;
}

function matchSmartLocalAssets(
  availableAssets: string[],
  queries: string[],
  usedAssets: Set<string>,
  preferVideo: boolean,
  onlyVideos: boolean,
): string | null {
  let candidatePool = availableAssets.filter((a) => !usedAssets.has(a));
  if (candidatePool.length === 0) candidatePool = availableAssets;

  if (onlyVideos) {
    candidatePool = candidatePool.filter(isVideoFile);
  } else if (preferVideo) {
    const videoMatches = candidatePool.filter(isVideoFile);
    if (videoMatches.length > 0) candidatePool = videoMatches;
  }

  if (candidatePool.length === 0) return null;

  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "shot", "style",
    "video", "photo", "image", "dark", "soft", "high", "cinematic", "real"
  ]);

  const allTokens = queries.flatMap((q) =>
    q
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
  );

  if (allTokens.length === 0) return null;

  let bestScore = 0;
  let bestMatches: string[] = [];

  for (const asset of candidatePool) {
    const assetLower = asset.toLowerCase();
    let score = 0;
    for (const token of allTokens) {
      if (assetLower.includes(token)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatches = [asset];
    } else if (score > 0 && score === bestScore) {
      bestMatches.push(asset);
    }
  }

  if (bestMatches.length > 0 && bestScore > 0) {
    return bestMatches[Math.floor(Math.random() * bestMatches.length)];
  }

  return null;
}

function getFallbackAsset(
  allAssets: string[],
  usedAssets: Set<string>,
  preferVideo: boolean,
): string {
  if (allAssets.length === 0) {
    return "fallback.jpg";
  }

  const unused = allAssets.filter((a) => !usedAssets.has(a));
  const pool = unused.length > 0 ? unused : allAssets;

  if (preferVideo) {
    const videoPool = pool.filter(isVideoFile);
    if (videoPool.length > 0) {
      return videoPool[Math.floor(Math.random() * videoPool.length)];
    }
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

async function downloadMedia(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download media: ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(destPath, buffer);
}

// ==========================================
// Remote API Client Methods
// ==========================================

async function getPexelsVideo(
  query: string,
  apiKey: string,
  usedPexelsVideoIds: Set<number>,
  isRelatableMode: boolean = false,
): Promise<string | null> {
  try {
    const searchQuery = resolveSearchQuery(query, isRelatableMode);
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(
      searchQuery,
    )}&orientation=portrait&per_page=8`;

    const res = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!res.ok) {
      console.error(`Pexels Video API responded with status ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data.videos || !Array.isArray(data.videos) || data.videos.length === 0) {
      return null;
    }

    let chosenVideo = data.videos[0];
    for (const v of data.videos) {
      if (!usedPexelsVideoIds.has(v.id)) {
        chosenVideo = v;
        break;
      }
    }

    usedPexelsVideoIds.add(chosenVideo.id);

    const videoFiles: Array<{
      id: number;
      quality: string;
      file_type?: string;
      width: number;
      height: number;
      link: string;
    }> = chosenVideo.video_files || [];

    // Prioritize vertical HD or SD mp4 file
    const bestFile =
      videoFiles.find(
        (f) =>
          (f.file_type === "video/mp4" || !f.file_type) &&
          f.height > f.width &&
          f.quality === "hd",
      ) ||
      videoFiles.find(
        (f) =>
          (f.file_type === "video/mp4" || !f.file_type) && f.height > f.width,
      ) ||
      videoFiles.find((f) => f.file_type === "video/mp4") ||
      videoFiles[0];

    if (!bestFile || !bestFile.link) return null;

    const videoId = chosenVideo.id;
    const filename = `pexels_video_${videoId}.mp4`;
    const libraryPath = path.join(process.cwd(), "image-library");
    const destPath = path.join(libraryPath, filename);

    if (!fs.existsSync(destPath)) {
      console.log(`Downloading Pexels vertical video ${videoId}...`);
      if (!fs.existsSync(libraryPath)) {
        fs.mkdirSync(libraryPath, { recursive: true });
      }
      await downloadMedia(bestFile.link, destPath);
    }

    return filename;
  } catch (err) {
    console.error("Error fetching from Pexels Video API:", err);
    return null;
  }
}

async function getPexelsPhoto(
  query: string,
  apiKey: string,
  usedPexelsIds: Set<number>,
  isRelatableMode: boolean = false,
): Promise<string | null> {
  try {
    const searchQuery = resolveSearchQuery(query, isRelatableMode);
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
      searchQuery,
    )}&orientation=portrait&per_page=8`;

    const res = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!res.ok) {
      console.error(`Pexels Photo API responded with status ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data.photos || !Array.isArray(data.photos) || data.photos.length === 0) {
      return null;
    }

    let chosenPhoto = data.photos[0];
    for (const photo of data.photos) {
      if (!usedPexelsIds.has(photo.id)) {
        chosenPhoto = photo;
        break;
      }
    }

    usedPexelsIds.add(chosenPhoto.id);

    const photoId = chosenPhoto.id;
    const imageUrl =
      chosenPhoto.src.portrait ||
      chosenPhoto.src.large ||
      chosenPhoto.src.original;
    if (!imageUrl) return null;

    const altText = chosenPhoto.alt || "";
    const slugifiedAlt = altText
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const filename = slugifiedAlt
      ? `pexels_${photoId}_${slugifiedAlt}.jpg`
      : `pexels_${photoId}.jpg`;

    const libraryPath = path.join(process.cwd(), "image-library");
    const destPath = path.join(libraryPath, filename);

    if (!fs.existsSync(destPath)) {
      console.log(`Downloading Pexels photo ${photoId}...`);
      if (!fs.existsSync(libraryPath)) {
        fs.mkdirSync(libraryPath, { recursive: true });
      }
      await downloadMedia(imageUrl, destPath);
    }

    return filename;
  } catch (err) {
    console.error("Error fetching from Pexels Photo API:", err);
    return null;
  }
}

async function getUnsplashPhoto(
  query: string,
  accessKey: string,
  usedUnsplashIds: Set<string>,
  isRelatableMode: boolean = false,
): Promise<string | null> {
  try {
    const searchQuery = resolveSearchQuery(query, isRelatableMode);
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      searchQuery,
    )}&orientation=portrait&per_page=8`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
    });

    if (!res.ok) {
      console.error(`Unsplash API responded with status ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
      return null;
    }

    let chosen = data.results[0];
    for (const r of data.results) {
      if (!usedUnsplashIds.has(String(r.id))) {
        chosen = r;
        break;
      }
    }

    usedUnsplashIds.add(String(chosen.id));

    const photoId = chosen.id;
    const imageUrl =
      chosen.urls?.regular || chosen.urls?.small || chosen.urls?.raw;
    if (!imageUrl) return null;

    const altText = chosen.alt_description || chosen.description || "";
    const slugifiedAlt = altText
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const filename = slugifiedAlt
      ? `unsplash_${photoId}_${slugifiedAlt}.jpg`
      : `unsplash_${photoId}.jpg`;

    const libraryPath = path.join(process.cwd(), "image-library");
    const destPath = path.join(libraryPath, filename);

    if (!fs.existsSync(destPath)) {
      console.log(`Downloading Unsplash photo ${photoId}...`);
      if (!fs.existsSync(libraryPath)) {
        fs.mkdirSync(libraryPath, { recursive: true });
      }
      await downloadMedia(imageUrl, destPath);
    }

    return filename;
  } catch (err) {
    console.error("Error fetching from Unsplash API:", err);
    return null;
  }
}

async function getPixabayVideo(
  query: string,
  apiKey: string,
  usedPixabayVideoIds: Set<number>,
  isRelatableMode: boolean = false,
): Promise<string | null> {
  if (!apiKey) return null;
  try {
    const searchQuery = resolveSearchQuery(query, isRelatableMode);
    const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(
      apiKey,
    )}&q=${encodeURIComponent(searchQuery)}&per_page=8`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.hits || !Array.isArray(data.hits) || data.hits.length === 0) {
      return null;
    }

    const unusedHits = data.hits.filter((hit: { id: number }) => !usedPixabayVideoIds.has(hit.id));
    const pool = unusedHits.length > 0 ? unusedHits : data.hits;

    // Prioritize vertical/portrait video clips
    const verticalHit = pool.find((hit: { videos?: { medium?: { width: number; height: number }; large?: { width: number; height: number } } }) => {
      const vid = hit.videos?.medium || hit.videos?.large;
      return vid && vid.height > vid.width;
    });

    const chosen = verticalHit || pool[0];
    usedPixabayVideoIds.add(chosen.id);

    const videoUrl =
      chosen.videos?.medium?.url ||
      chosen.videos?.large?.url ||
      chosen.videos?.small?.url;

    if (!videoUrl) return null;

    const filename = `pixabay_video_${chosen.id}.mp4`;
    const libraryPath = path.join(process.cwd(), "image-library");
    const destPath = path.join(libraryPath, filename);

    if (!fs.existsSync(destPath)) {
      console.log(`Downloading Pixabay video ${chosen.id}...`);
      if (!fs.existsSync(libraryPath)) {
        fs.mkdirSync(libraryPath, { recursive: true });
      }
      await downloadMedia(videoUrl, destPath);
    }

    return filename;
  } catch (err) {
    console.error("Error fetching from Pixabay Video API:", err);
    return null;
  }
}

async function getPixabayPhoto(
  query: string,
  apiKey: string,
  usedPixabayPhotoIds: Set<number>,
  isRelatableMode: boolean = false,
): Promise<string | null> {
  if (!apiKey) return null;
  try {
    const searchQuery = resolveSearchQuery(query, isRelatableMode);
    const url = `https://pixabay.com/api/?key=${encodeURIComponent(
      apiKey,
    )}&q=${encodeURIComponent(searchQuery)}&image_type=photo&orientation=vertical&per_page=8`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.hits || !Array.isArray(data.hits) || data.hits.length === 0) {
      return null;
    }

    let chosen = data.hits[0];
    for (const hit of data.hits) {
      if (!usedPixabayPhotoIds.has(hit.id)) {
        chosen = hit;
        break;
      }
    }
    usedPixabayPhotoIds.add(chosen.id);

    const imageUrl = chosen.largeImageURL || chosen.webformatURL;
    if (!imageUrl) return null;

    const filename = `pixabay_photo_${chosen.id}.jpg`;
    const libraryPath = path.join(process.cwd(), "image-library");
    const destPath = path.join(libraryPath, filename);

    if (!fs.existsSync(destPath)) {
      console.log(`Downloading Pixabay photo ${chosen.id}...`);
      if (!fs.existsSync(libraryPath)) {
        fs.mkdirSync(libraryPath, { recursive: true });
      }
      await downloadMedia(imageUrl, destPath);
    }

    return filename;
  } catch (err) {
    console.error("Error fetching from Pixabay Photo API:", err);
    return null;
  }
}
