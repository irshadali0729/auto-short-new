import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string | string[] }> }
) {
  try {
    const { filename } = await params;
    const rawSegments = Array.isArray(filename) ? filename : [filename];
    const decodedSegments = rawSegments.flatMap((segment) =>
      decodeURIComponent(segment).replace(/\\/g, '/').split('/')
    ).filter(Boolean);

    const projectRoot = process.cwd();
    const imageLibraryDir = path.resolve(projectRoot, 'image-library');
    const filePath = path.resolve(imageLibraryDir, ...decodedSegments);

    // Prevent directory traversal attacks
    if (!filePath.startsWith(imageLibraryDir)) {
      return new NextResponse('Access Denied', { status: 403 });
    }

    if (!fs.existsSync(filePath)) {
      return new NextResponse('Asset not found', { status: 404 });
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return new NextResponse('Asset is not a file', { status: 400 });
    }

    let contentType = 'image/jpeg';
    const lowerName = filePath.toLowerCase();
    if (lowerName.endsWith('.png')) {
      contentType = 'image/png';
    } else if (lowerName.endsWith('.gif')) {
      contentType = 'image/gif';
    } else if (lowerName.endsWith('.webp')) {
      contentType = 'image/webp';
    } else if (lowerName.endsWith('.mp4')) {
      contentType = 'video/mp4';
    } else if (lowerName.endsWith('.webm')) {
      contentType = 'video/webm';
    } else if (lowerName.endsWith('.mov')) {
      contentType = 'video/quicktime';
    } else if (lowerName.endsWith('.svg')) {
      contentType = 'image/svg+xml';
    }

    // Support HTTP Range headers for smooth HTML5 video playback & fast frame preview
    const rangeHeader = request.headers.get('range');
    if (rangeHeader && stat.size > 0 && contentType.startsWith('video/')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        },
      });

      return new NextResponse(stream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
        },
      });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving asset:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
