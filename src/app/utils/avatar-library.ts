import fs from 'fs';
import path from 'path';

export interface AvatarVideoInfo {
  filename: string;
  relativePath: string;
  category: string;
  avatarId: string;
  sizeBytes: number;
}

export interface AvatarInfo {
  id: string;
  category: string;
  thumbnail: string | null;
  videoCount: number;
}

const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'];
const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function avatarsRoot(): string {
  return path.join(process.cwd(), 'image-library', 'avatars');
}

/**
 * Lists every avatar folder inside a category (e.g. "women_avatars"), each
 * with its thumbnail image and video count, for the settings avatar picker.
 */
export function listAvatars(category: string = 'women_avatars'): AvatarInfo[] {
  const categoryDir = path.join(avatarsRoot(), category);
  if (!fs.existsSync(categoryDir)) return [];

  try {
    const entries = fs.readdirSync(categoryDir, { withFileTypes: true });
    const avatars: AvatarInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const avatarDir = path.join(categoryDir, entry.name);
      const files = fs.readdirSync(avatarDir);

      let thumbnail: string | null = null;
      let videoCount = 0;

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) {
          videoCount += 1;
        } else if (!thumbnail && SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
          thumbnail = `avatars/${category}/${entry.name}/${file}`;
        }
      }

      avatars.push({ id: entry.name, category, thumbnail, videoCount });
    }

    return avatars.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  } catch (error) {
    console.error('Error listing avatars:', error);
    return [];
  }
}

/**
 * Recursively scans a single avatar's folder for video files.
 * Returns relative paths (e.g., "avatars/women_avatars/Avatar-1/women-girl-gesture-1.mp4")
 */
export function getAvatarVideos(
  category: string = 'women_avatars',
  avatarId: string = 'Avatar-1',
): AvatarVideoInfo[] {
  const avatarDir = path.join(avatarsRoot(), category, avatarId);
  if (!fs.existsSync(avatarDir)) return [];

  try {
    const files = fs.readdirSync(avatarDir);
    const avatarVideos: AvatarVideoInfo[] = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) {
        const fullPath = path.join(avatarDir, file);
        const stats = fs.statSync(fullPath);
        const relativePath = path
          .relative(path.join(process.cwd(), 'image-library'), fullPath)
          .replace(/\\/g, '/');

        avatarVideos.push({
          filename: file,
          relativePath,
          category,
          avatarId,
          sizeBytes: stats.size,
        });
      }
    }

    return avatarVideos.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
  } catch (error) {
    console.error('Error scanning avatar video library:', error);
    return [];
  }
}

/**
 * Pick a random avatar video for the selected avatar, optionally excluding the
 * last used video to ensure variation across scenes while keeping the same avatar.
 */
export function pickRandomAvatarVideo(
  category: string = 'women_avatars',
  avatarId: string = 'Avatar-1',
  excludePath?: string,
): string | null {
  const videos = getAvatarVideos(category, avatarId);
  if (videos.length === 0) return null;

  if (videos.length === 1) return videos[0].relativePath;

  const candidates = excludePath
    ? videos.filter((v) => v.relativePath !== excludePath)
    : videos;

  const pool = candidates.length > 0 ? candidates : videos;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex].relativePath;
}
