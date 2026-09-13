import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.mov'];

function scanDirectory(dir: string, baseDir: string): string[] {
  let results: string[] = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'temp' && file !== 'node_modules') {
          results = results.concat(scanDirectory(fullPath, baseDir));
        }
      } else {
        const ext = path.extname(file).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          results.push(relPath);
        }
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }
  return results;
}

export async function GET() {
  try {
    const libraryPath = path.join(process.cwd(), 'image-library');

    if (!fs.existsSync(libraryPath)) {
      return NextResponse.json({ images: [] });
    }

    const availableImages = scanDirectory(libraryPath, libraryPath).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ images: availableImages });
  } catch (error: unknown) {
    console.error('Error listing image files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scan image library.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

