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

export async function POST(request: Request) {
  try {
    const { scenes } = await request.json();

    if (!scenes || !Array.isArray(scenes)) {
      return NextResponse.json(
        { error: "Scenes list is required." },
        { status: 400 },
      );
    }

    const libraryPath = path.join(process.cwd(), "image-library");
    const pexelsApiKey = process.env.PEXELS_API_KEY || "";
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY || "";

    if (!fs.existsSync(libraryPath)) {
      fs.mkdirSync(libraryPath, { recursive: true });
    }

    const allFiles = fs.readdirSync(libraryPath);
    const supportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const availableImages = allFiles.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return supportedExtensions.includes(ext);
    });

    const matchedScenes: Array<{
      keyword: string;
      duration: number;
      image: string;
      isFallback: boolean;
      graphics?: GraphicBeat[];
    }> = [];

    const usedImages = new Set<string>();
    const usedPexelsIds = new Set<number>();
    const usedUnsplashIds = new Set<string>();

    for (const scene of scenes) {
      const { keyword, duration, graphics } = scene;
      const kw = keyword ? keyword.trim() : "";

      if (!kw) {
        const fallback = getUnusedRandomImage(availableImages, usedImages);
        matchedScenes.push({
          keyword,
          duration,
          image: fallback,
          isFallback: true,
          graphics: Array.isArray(graphics) ? graphics : undefined,
        });
        usedImages.add(fallback);
        continue;
      }

      const providers: string[] = [];
      if (pexelsApiKey) providers.push("pexels");
      if (unsplashKey) providers.push("unsplash");

      if (providers.length > 0) {
        for (let i = providers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [providers[i], providers[j]] = [providers[j], providers[i]];
        }

        let found = false;
        for (const provider of providers) {
          if (provider === "pexels") {
            const pexelsFilename = await getPexelsPhoto(
              kw,
              pexelsApiKey,
              usedPexelsIds,
            );
            if (pexelsFilename) {
              matchedScenes.push({
                keyword,
                duration,
                image: pexelsFilename,
                isFallback: false,
                graphics: Array.isArray(graphics) ? graphics : undefined,
              });
              usedImages.add(pexelsFilename);
              found = true;
              break;
            }
          } else if (provider === "unsplash") {
            const unsplashFilename = await getUnsplashPhoto(
              kw,
              unsplashKey,
              usedUnsplashIds,
            );
            if (unsplashFilename) {
              matchedScenes.push({
                keyword,
                duration,
                image: unsplashFilename,
                isFallback: false,
                graphics: Array.isArray(graphics) ? graphics : undefined,
              });
              usedImages.add(unsplashFilename);
              found = true;
              break;
            }
          }
        }

        if (found) continue;
      }

      let matches = availableImages.filter(
        (img) =>
          img.toLowerCase().includes(kw.toLowerCase()) && !usedImages.has(img),
      );

      if (matches.length === 0) {
        matches = availableImages.filter((img) =>
          img.toLowerCase().includes(kw.toLowerCase()),
        );
      }

      if (matches.length === 0) {
        const words = kw
          .toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 2);
        for (const word of words) {
          matches = availableImages.filter(
            (img) => img.toLowerCase().includes(word) && !usedImages.has(img),
          );
          if (matches.length > 0) break;
        }
      }

      if (matches.length > 0) {
        const chosen = matches[Math.floor(Math.random() * matches.length)];
        matchedScenes.push({
          keyword,
          duration,
          image: chosen,
          isFallback: false,
          graphics: Array.isArray(graphics) ? graphics : undefined,
        });
        usedImages.add(chosen);
      } else {
        const fallback = getUnusedRandomImage(availableImages, usedImages);
        matchedScenes.push({
          keyword,
          duration,
          image: fallback,
          isFallback: true,
          graphics: Array.isArray(graphics) ? graphics : undefined,
        });
        usedImages.add(fallback);
      }
    }

    return NextResponse.json({ matches: matchedScenes });
  } catch (error: unknown) {
    console.error("Error matching images:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function getUnusedRandomImage(
  allImages: string[],
  usedImages: Set<string>,
): string {
  if (allImages.length === 0) {
    return "fallback.jpg";
  }
  const unused = allImages.filter((img) => !usedImages.has(img));
  const pool = unused.length > 0 ? unused : allImages;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function downloadImage(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download image: ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(destPath, buffer);
}

async function getPexelsPhoto(
  query: string,
  apiKey: string,
  usedPexelsIds: Set<number>,
): Promise<string | null> {
  try {
    let searchQuery = query.trim().toLowerCase();
    const islamicKeywords = [
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
    const hasIslamicContext = islamicKeywords.some((k) =>
      searchQuery.includes(k),
    );

    if (!hasIslamicContext) {
      searchQuery = `${query.trim()} Muslim`;
    } else {
      searchQuery = query.trim();
    }

    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&orientation=portrait&per_page=5`;
    const res = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!res.ok) {
      console.error(`Pexels API responded with status ${res.status}`);
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
    const imageUrl = chosenPhoto.src.portrait || chosenPhoto.src.large || chosenPhoto.src.original;
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

    // Download and cache if it doesn't exist
    if (!fs.existsSync(destPath)) {
      console.log(`Downloading Pexels photo ${photoId} from ${imageUrl}`);
      if (!fs.existsSync(libraryPath)) {
        fs.mkdirSync(libraryPath, { recursive: true });
      }
      await downloadImage(imageUrl, destPath);
    }

    return filename;
  } catch (err) {
    console.error("Error fetching/downloading from Pexels API:", err);
    return null;
  }
}

async function getUnsplashPhoto(
  query: string,
  accessKey: string,
  usedUnsplashIds: Set<string>,
): Promise<string | null> {
  try {
    let searchQuery = query.trim();
    const islamicKeywords = [
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
    const hasIslamicContext = islamicKeywords.some((k) =>
      searchQuery.toLowerCase().includes(k),
    );

    if (!hasIslamicContext) {
      searchQuery = `${query.trim()} Muslim`;
    }

    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      searchQuery,
    )}&orientation=portrait&per_page=5`;

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
    if (
      !data.results ||
      !Array.isArray(data.results) ||
      data.results.length === 0
    ) {
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
      console.log(`Downloading Unsplash photo ${photoId} from ${imageUrl}`);
      if (!fs.existsSync(libraryPath))
        fs.mkdirSync(libraryPath, { recursive: true });
      await downloadImage(imageUrl, destPath);
    }

    return filename;
  } catch (err) {
    console.error("Error fetching/downloading from Unsplash API:", err);
    return null;
  }
}
