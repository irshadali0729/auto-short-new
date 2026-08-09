import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { scenes } = await request.json();

    if (!scenes || !Array.isArray(scenes)) {
      return NextResponse.json({ error: 'Scenes list is required.' }, { status: 400 });
    }

    const libraryPath = path.join(process.cwd(), 'image-library');
    const pexelsApiKey = process.env.PEXELS_API_KEY || '';

    // Ensure image-library folder exists
    if (!fs.existsSync(libraryPath)) {
      fs.mkdirSync(libraryPath, { recursive: true });
    }

    const allFiles = fs.readdirSync(libraryPath);
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const availableImages = allFiles.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return supportedExtensions.includes(ext);
    });

    if (availableImages.length === 0 && !pexelsApiKey) {
      return NextResponse.json(
        { error: 'No compatible images found in the "image-library" folder. Please add image files (.jpg, .jpeg, .png, .webp, .gif) or configure a Pexels API Key.' },
        { status: 400 }
      );
    }

    const matchedScenes: Array<{
      keyword: string;
      duration: number;
      image: string;
      isFallback: boolean;
    }> = [];

    const usedImages = new Set<string>();
    const usedPexelsIds = new Set<number>();

    for (const scene of scenes) {
      const { keyword, duration } = scene;
      const kw = keyword ? keyword.trim() : '';

      if (!kw) {
        const fallback = getUnusedRandomImage(availableImages, usedImages);
        matchedScenes.push({
          keyword,
          duration,
          image: fallback,
          isFallback: true,
        });
        usedImages.add(fallback);
        continue;
      }

      // 1. Try Pexels API integration if key exists
      if (pexelsApiKey) {
        const pexelsFilename = await getPexelsPhoto(kw, pexelsApiKey, usedPexelsIds);
        if (pexelsFilename) {
          matchedScenes.push({
            keyword,
            duration,
            image: pexelsFilename,
            isFallback: false,
          });
          usedImages.add(pexelsFilename);
          continue;
        }
      }

      // 2. Local Fallback - Direct case-insensitive substring match among unused images
      let matches = availableImages.filter(img =>
        img.toLowerCase().includes(kw.toLowerCase()) && !usedImages.has(img)
      );

      // If no unused direct match, try allowing previously used images for this keyword
      if (matches.length === 0) {
        matches = availableImages.filter(img =>
          img.toLowerCase().includes(kw.toLowerCase())
        );
      }

      // 3. Local Fallback - Word-by-word matching among unused images
      if (matches.length === 0) {
        const words = kw.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        for (const word of words) {
          matches = availableImages.filter(img =>
            img.toLowerCase().includes(word) && !usedImages.has(img)
          );
          if (matches.length > 0) break;
        }
      }

      // If local matches exist, pick a random one
      if (matches.length > 0) {
        const chosen = matches[Math.floor(Math.random() * matches.length)];
        matchedScenes.push({
          keyword,
          duration,
          image: chosen,
          isFallback: false,
        });
        usedImages.add(chosen);
      } else {
        // 4. Ultimate Fallback: Select a completely random unused image, or any image if all have been used
        const fallback = getUnusedRandomImage(availableImages, usedImages);
        matchedScenes.push({
          keyword,
          duration,
          image: fallback,
          isFallback: true,
        });
        usedImages.add(fallback);
      }
    }

    return NextResponse.json({ matches: matchedScenes });
  } catch (error: unknown) {
    console.error('Error matching images:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

function getUnusedRandomImage(allImages: string[], usedImages: Set<string>): string {
  if (allImages.length === 0) {
    return 'fallback.jpg'; // Ultimate safety default
  }
  const unused = allImages.filter(img => !usedImages.has(img));
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

async function getPexelsPhoto(query: string, apiKey: string, usedPexelsIds: Set<number>): Promise<string | null> {
  try {
    // Ensure Islamic/Muslim context for general query keywords
    let searchQuery = query.trim().toLowerCase();
    const islamicKeywords = ['muslim', 'islam', 'quran', 'mosque', 'hadith', 'allah', 'hijab', 'salah', 'kaaba', 'mecca', 'madina', 'dua'];
    const hasIslamicContext = islamicKeywords.some(k => searchQuery.includes(k));
    
    if (!hasIslamicContext) {
      searchQuery = `${query.trim()} Muslim`;
    } else {
      searchQuery = query.trim();
    }

    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&orientation=portrait&per_page=5`;
    const res = await fetch(url, {
      headers: {
        'Authorization': apiKey
      }
    });

    if (!res.ok) {
      console.error(`Pexels API responded with status ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data.photos || !Array.isArray(data.photos) || data.photos.length === 0) {
      return null;
    }

    // Find first photo not used in this run
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

    const libraryPath = path.join(process.cwd(), 'image-library');
    const filename = `pexels_${photoId}.jpg`;
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
    console.error('Error fetching/downloading from Pexels API:', err);
    return null;
  }
}
