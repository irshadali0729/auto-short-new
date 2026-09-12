import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const libraryPath = path.join(process.cwd(), 'image-library');

    if (!fs.existsSync(libraryPath)) {
      return NextResponse.json({ images: [] });
    }

    const allFiles = fs.readdirSync(libraryPath);
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm'];
    
    // Sort alphabetically for clean presentation
    const availableImages = allFiles
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return supportedExtensions.includes(ext);
      })
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ images: availableImages });
  } catch (error: unknown) {
    console.error('Error listing image files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scan image library.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
