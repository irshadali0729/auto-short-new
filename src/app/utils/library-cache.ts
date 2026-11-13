import fs from 'fs';
import path from 'path';

export interface CachedMediaItem {
  filename: string;         // e.g. "pexels_14940052.jpg"
  relativePath: string;     // e.g. "Hijabi Girl/pexels_14940052.jpg"
  category: string;         // e.g. "Hijabi Girl" or "root"
  isVideo: boolean;
  ext: string;
  sizeBytes: number;
}

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.mov'];
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

let cachedLibraryItems: CachedMediaItem[] | null = null;
let lastCacheTime = 0;

// Scans one directory's entries and recurses into subdirectories in parallel.
// Uses the async fs API so a large library scan doesn't block the event loop
// the way a chain of synchronous fs calls would.
async function scanDirectoryRecursively(dir: string, baseDir: string): Promise<CachedMediaItem[]> {
  let items: CachedMediaItem[] = [];
  try {
    const exists = await fs.promises
      .access(dir)
      .then(() => true)
      .catch(() => false);
    if (!exists) return items;

    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    const subdirScans: Promise<CachedMediaItem[]>[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden folders, temp directories, node_modules, the avatar
        // presenter library (avatar clips are resolved via avatar-library.ts,
        // not the general stock-media matching cascade), and CTA animations
        // (resolved via cta-library.ts).
        if (
          !entry.name.startsWith('.') &&
          entry.name !== 'temp' &&
          entry.name !== 'node_modules' &&
          entry.name !== 'avatars' &&
          entry.name !== 'cta'
        ) {
          subdirScans.push(scanDirectoryRecursively(fullPath, baseDir));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          const relDir = path.dirname(relPath);
          const category = relDir === '.' || relDir === '' ? 'General' : relDir.split('/')[0];
          const isVideo = /\.(mp4|webm|mov)$/i.test(ext);

          items.push({
            filename: entry.name,
            relativePath: relPath,
            category,
            isVideo,
            ext,
            // File size is not needed by any current consumer (list-images,
            // match-images) — computing it here used to mean one blocking
            // fs.statSync() per file on every cold-cache scan. It's now left
            // at 0 and only resolved on demand via getAssetSizeBytes().
            sizeBytes: 0,
          });
        }
      }
    }

    const subdirResults = await Promise.all(subdirScans);
    for (const result of subdirResults) {
      items = items.concat(result);
    }
  } catch (err) {
    console.error(`[library-cache] Error scanning directory ${dir}:`, err);
  }
  return items;
}

/**
 * Returns the cached list of all media items in image-library (0ms in-memory read when warm).
 */
export async function getCachedLibrary(forceRefresh: boolean = false): Promise<CachedMediaItem[]> {
  const now = Date.now();

  if (!forceRefresh && cachedLibraryItems && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedLibraryItems;
  }

  const projectRoot = process.cwd();
  const libraryPath = path.join(projectRoot, 'image-library');

  if (!fs.existsSync(libraryPath)) {
    try {
      fs.mkdirSync(libraryPath, { recursive: true });
    } catch {
      // Ignore directory creation error
    }
  }

  const scanned = await scanDirectoryRecursively(libraryPath, libraryPath);
  cachedLibraryItems = scanned.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  lastCacheTime = now;

  return cachedLibraryItems;
}

/**
 * Invalidate in-memory cache when new files are saved or modified.
 */
export function invalidateLibraryCache(): void {
  cachedLibraryItems = null;
  lastCacheTime = 0;
}

/**
 * Appends a single freshly-downloaded asset directly into the warm cache
 * instead of forcing a full re-scan of the whole library. `match-images`
 * calls this after every stock-media download, so without it a video with
 * many scenes would trigger a full recursive re-scan per scene.
 */
export function addLibraryCacheItem(item: CachedMediaItem): void {
  if (!cachedLibraryItems) return; // cache is cold; next read will scan fresh anyway
  if (cachedLibraryItems.some((i) => i.relativePath === item.relativePath)) return;
  cachedLibraryItems.push(item);
  cachedLibraryItems.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/**
 * Resolves a single asset's on-disk size on demand, for the rare caller that
 * actually needs it (the bulk scan intentionally skips this).
 */
export function getAssetSizeBytes(relativePathOrFilename: string): number {
  try {
    const fullPath = path.join(process.cwd(), 'image-library', relativePathOrFilename);
    return fs.statSync(fullPath).size;
  } catch {
    return 0;
  }
}

/**
 * Fast in-memory search across category folders and filenames.
 */
export async function searchCachedLibrary(
  query: string,
  options?: {
    category?: string;
    mediaType?: 'only_videos' | 'only_images' | 'both';
  }
): Promise<CachedMediaItem[]> {
  const library = await getCachedLibrary();
  const lowerQuery = query.toLowerCase().trim();
  const filterType = options?.mediaType || 'both';
  const targetCategory = options?.category ? options.category.toLowerCase().trim() : null;

  return library.filter((item) => {
    // 1. Media type filter
    if (filterType === 'only_videos' && !item.isVideo) return false;
    if (filterType === 'only_images' && item.isVideo) return false;

    // 2. Category filter
    if (targetCategory && targetCategory !== 'all' && item.category.toLowerCase() !== targetCategory) {
      return false;
    }

    // 3. Text query match (searches relative path, category, and filename)
    if (lowerQuery) {
      const matchRel = item.relativePath.toLowerCase().includes(lowerQuery);
      const matchCat = item.category.toLowerCase().includes(lowerQuery);
      const matchFile = item.filename.toLowerCase().includes(lowerQuery);
      if (!matchRel && !matchCat && !matchFile) {
        return false;
      }
    }

    return true;
  });
}
