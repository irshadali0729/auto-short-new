import { NextResponse } from 'next/server';
import { getCachedLibrary } from '@/app/utils/library-cache';

export async function GET() {
  try {
    const cachedItems = getCachedLibrary();
    const availableImages = cachedItems.map((item) => item.relativePath);

    return NextResponse.json({ images: availableImages });
  } catch (error: unknown) {
    console.error('Error listing image files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scan image library.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


