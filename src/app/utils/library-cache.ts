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

function scanDirectoryRecursively(dir: string, baseDir: string): CachedMediaItem[] {
  let items: CachedMediaItem[] = [];
  try {
    if (!fs.existsSync(dir)) return items;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip hidden folders, temp directories, or node_modules
        if (!entry.name.startsWith('.') && entry.name !== 'temp' && entry.name !== 'node_modules') {
          items = items.concat(scanDirectoryRecursively(fullPath, baseDir));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          const relDir = path.dirname(relPath);
          const category = relDir === '.' || relDir === '' ? 'General' : relDir.split('/')[0];
          const isVideo = /\.(mp4|webm|mov)$/i.test(ext);
          
          let sizeBytes = 0;
          try {
            const stats = fs.statSync(fullPath);
            sizeBytes = stats.size;
          } catch {
            // Ignore stat errors
          }

          items.push({
            filename: entry.name,
            relativePath: relPath,
            category,
            isVideo,
            ext,
            sizeBytes,
          });
        }
      }
    }
  } catch (err) {
    console.error(`[library-cache] Error scanning directory ${dir}:`, err);
  }
  return items;
}

/**
 * Returns the cached list of all media items in image-library (0ms in-memory read when warm).
 */
export function getCachedLibrary(forceRefresh: boolean = false): CachedMediaItem[] {
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

  const scanned = scanDirectoryRecursively(libraryPath, libraryPath);
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
 * Fast in-memory search across category folders and filenames.
 */
export function searchCachedLibrary(
  query: string,
  options?: {
    category?: string;
    mediaType?: 'only_videos' | 'only_images' | 'both';
  }
): CachedMediaItem[] {
  const library = getCachedLibrary();
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
