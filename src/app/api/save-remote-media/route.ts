import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { addLibraryCacheItem } from '@/app/utils/library-cache';

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.mov']);

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'A valid remote media URL is required.' }, { status: 400 });
    }

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: `Failed to download media (${res.status}).` }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || '';
    let ext = path.extname(new URL(url).pathname).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      ext = EXT_BY_CONTENT_TYPE[contentType.split(';')[0].trim()] || '';
    }
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: 'Unsupported media type for saving locally.' }, { status: 400 });
    }

    const isVideo = /\.(mp4|webm|mov)$/i.test(ext);
    const filename = `saved_${Date.now()}${ext}`;
    const libraryPath = path.join(process.cwd(), 'image-library');
    if (!fs.existsSync(libraryPath)) {
      fs.mkdirSync(libraryPath, { recursive: true });
    }
    const destPath = path.join(libraryPath, filename);

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buffer);

    addLibraryCacheItem({
      filename,
      relativePath: filename,
      category: 'General',
      isVideo,
      ext,
      sizeBytes: buffer.byteLength,
    });

    return NextResponse.json({ filename });
  } catch (error: unknown) {
    console.error('Error saving remote media locally:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to save media locally.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
