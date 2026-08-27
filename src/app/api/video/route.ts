import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { cleanupAssets } from '@/app/utils/cleanup';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isDownload = searchParams.get('download') === 'true';
    const isProduction = process.env.NODE_ENV === 'production' || process.env.CLEANUP_ASSETS === 'true';

    const filePath = path.join(process.cwd(), 'generated', 'output.mp4');

    if (!fs.existsSync(filePath)) {
      return new NextResponse('Video not found. Please click Generate first.', { status: 404 });
    }

    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const range = request.headers.get('range');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new NextResponse('Requested range not satisfiable', {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        });
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      if (isDownload && isProduction) {
        fileStream.on('close', () => {
          setTimeout(() => {
            cleanupAssets();
          }, 3000);
        });
      }

      // Build a standard web stream compatible with NextResponse
      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        }
      });

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': 'video/mp4',
        },
      });
    } else {
      const fileStream = fs.createReadStream(filePath);

      if (isDownload && isProduction) {
        fileStream.on('close', () => {
          setTimeout(() => {
            cleanupAssets();
          }, 3000);
        });
      }

      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        }
      });

      return new NextResponse(webStream, {
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': fileSize.toString(),
          'Content-Type': 'video/mp4',
        },
      });
    }
  } catch (error) {
    console.error('Error streaming output video:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
