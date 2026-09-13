import fs from 'fs';
import path from 'path';

export interface HostVideoInfo {
  filename: string;
  relativePath: string;
  hostType: string;
  sizeBytes: number;
}

const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'];

/**
 * Recursively scans the image-library/host folder for video files.
 * Returns relative paths (e.g., "host/women_host/women-girl-gesture-1.mp4")
 */
export function getHostVideos(hostSubfolder: string = 'women_host'): HostVideoInfo[] {
  const projectRoot = process.cwd();
  const hostDir = path.join(projectRoot, 'image-library', 'host', hostSubfolder);

  if (!fs.existsSync(hostDir)) {
    // Check if image-library/host itself exists
    const baseHostDir = path.join(projectRoot, 'image-library', 'host');
    if (!fs.existsSync(baseHostDir)) {
      return [];
    }
  }

  const targetDir = fs.existsSync(hostDir) 
    ? hostDir 
    : path.join(projectRoot, 'image-library', 'host');

  try {
    const files = fs.readdirSync(targetDir);
    const hostVideos: HostVideoInfo[] = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) {
        const fullPath = path.join(targetDir, file);
        const stats = fs.statSync(fullPath);
        const relativePath = path.relative(path.join(projectRoot, 'image-library'), fullPath).replace(/\\/g, '/');
        
        hostVideos.push({
          filename: file,
          relativePath,
          hostType: hostSubfolder,
          sizeBytes: stats.size,
        });
      }
    }

    // Sort naturally by filename
    return hostVideos.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
  } catch (error) {
    console.error('Error scanning host video library:', error);
    return [];
  }
}

/**
 * Pick a random host video from the available list, optionally excluding the last used video
 * to ensure variation across scenes.
 */
export function pickRandomHostVideo(
  hostSubfolder: string = 'women_host',
  excludePath?: string
): string | null {
  const videos = getHostVideos(hostSubfolder);
  if (videos.length === 0) return null;

  if (videos.length === 1) return videos[0].relativePath;

  const candidates = excludePath 
    ? videos.filter(v => v.relativePath !== excludePath) 
    : videos;

  const pool = candidates.length > 0 ? candidates : videos;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex].relativePath;
}
