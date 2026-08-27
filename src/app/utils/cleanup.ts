import fs from 'fs';
import path from 'path';

export function cleanupAssets() {
  try {
    const projectRoot = process.cwd();
    
    // 1. Delete output.mp4
    const outputVideoPath = path.join(projectRoot, 'generated', 'output.mp4');
    if (fs.existsSync(outputVideoPath)) {
      try {
        fs.unlinkSync(outputVideoPath);
        console.log('Successfully cleaned up output.mp4');
      } catch (err) {
        console.error('Failed to delete output.mp4:', err);
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
