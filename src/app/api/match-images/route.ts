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

    if (!fs.existsSync(libraryPath)) {
      return NextResponse.json(
        { error: 'The "image-library" directory does not exist. Please create an "image-library" folder in your project root and add your media assets.' },
        { status: 400 }
      );
    }

    const allFiles = fs.readdirSync(libraryPath);
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const availableImages = allFiles.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return supportedExtensions.includes(ext);
    });

    if (availableImages.length === 0) {
      return NextResponse.json(
        { error: 'No compatible images found in the "image-library" folder. Please add image files (.jpg, .jpeg, .png, .webp, .gif).' },
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

      // 1. Direct case-insensitive substring match among unused images
      let matches = availableImages.filter(img =>
        img.toLowerCase().includes(kw.toLowerCase()) && !usedImages.has(img)
      );

      // If no unused direct match, try allowing previously used images for this keyword
      if (matches.length === 0) {
        matches = availableImages.filter(img =>
          img.toLowerCase().includes(kw.toLowerCase())
        );
      }

      // 2. Word-by-word matching among unused images
      if (matches.length === 0) {
        const words = kw.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        for (const word of words) {
          matches = availableImages.filter(img =>
            img.toLowerCase().includes(word) && !usedImages.has(img)
          );
          if (matches.length > 0) break;
        }
      }

      // If matches exist, pick a random one
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
        // 3. Fallback: Select a completely random unused image, or any image if all have been used
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
  const unused = allImages.filter(img => !usedImages.has(img));
  const pool = unused.length > 0 ? unused : allImages;
  return pool[Math.floor(Math.random() * pool.length)];
}
