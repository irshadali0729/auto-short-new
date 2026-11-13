import fs from 'fs';
import path from 'path';

/**
 * CLEANUP_ASSETS=true forces cleanup on, CLEANUP_ASSETS=false forces it off;
 * unset, it runs only in production. Previously any production run
 * (`npm run start`) cleaned up even with CLEANUP_ASSETS=false, deleting every
 * downloaded stock image the user's storyboard still referenced.
 */
export function isCleanupEnabled(): boolean {
  const flag = process.env.CLEANUP_ASSETS?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function cleanupAssets() {
  try {
    const projectRoot = process.cwd();
    
    // 1. Delete output.mp4 (and its cached 720p export)
    for (const name of ['output.mp4', 'output_720.mp4']) {
      const outputVideoPath = path.join(projectRoot, 'generated', name);
      if (fs.existsSync(outputVideoPath)) {
        try {
          fs.unlinkSync(outputVideoPath);
          console.log(`Successfully cleaned up ${name}`);
        } catch (err) {
          console.error(`Failed to delete ${name}:`, err);
        }
      }
    }

    // 2. Delete pexels_ and unsplash_ images in image-library
    const libraryPath = path.join(projectRoot, 'image-library');
    if (fs.existsSync(libraryPath)) {
      const files = fs.readdirSync(libraryPath);
      for (const file of files) {
        if (file.startsWith('pexels_') || file.startsWith('unsplash_')) {
          try {
            fs.unlinkSync(path.join(libraryPath, file));
            console.log(`Successfully cleaned up image: ${file}`);
          } catch (err) {
            console.error(`Failed to delete image ${file}:`, err);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error during assets cleanup:', error);
  }
}
