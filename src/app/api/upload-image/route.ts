import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { addLibraryCacheItem } from '@/app/utils/library-cache';

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.mov']);

function sanitizeBaseName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9_\-.]/g, '_');
  return base.slice(0, 80) || 'upload';
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file was provided.' }, { status: 400 });
    }

    const originalName = 'name' in file && typeof file.name === 'string' ? file.name : 'upload';
    const ext = path.extname(originalName).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: `Unsupported file type "${ext || 'unknown'}".` }, { status: 400 });
    }

    const isVideo = /\.(mp4|webm|mov)$/i.test(ext);
    const safeBaseName = sanitizeBaseName(originalName.slice(0, originalName.length - ext.length));
    const filename = `local_${Date.now()}_${safeBaseName}${ext}`;

    const libraryDir = path.join(process.cwd(), 'image-library', 'local');
    if (!fs.existsSync(libraryDir)) {
      fs.mkdirSync(libraryDir, { recursive: true });
    }
    const destPath = path.join(libraryDir, filename);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(destPath, buffer);

    const relativePath = `local/${filename}`;
    addLibraryCacheItem({
      filename,
      relativePath,
      category: 'local',
      isVideo,
      ext,
      sizeBytes: buffer.byteLength,
    });

    return NextResponse.json({ filename: relativePath });
  } catch (error: unknown) {
    console.error('Error uploading local image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload file.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
