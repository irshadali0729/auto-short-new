import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { cleanupAssets, isCleanupEnabled } from '@/app/utils/cleanup';
import { FFMPEG_PRESET } from '@/app/config/video-config';

// Downscales the 1080p master to 720p on first request (cached until the
// master is regenerated), for the Export panel's quality choice.
function ensure720p(sourcePath: string): Promise<string> {
  const targetPath = path.join(path.dirname(sourcePath), 'output_720.mp4');
  if (
    fs.existsSync(targetPath) &&
    fs.statSync(targetPath).mtimeMs >= fs.statSync(sourcePath).mtimeMs
  ) {
    return Promise.resolve(targetPath);
  }
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegInstaller.path, [
      '-y',
      '-i', sourcePath,
      // Short side becomes 720 for both 9:16 and 16:9 masters.
      '-vf', 'scale=w=if(gt(iw\\,ih)\\,1280\\,720):h=-2',
      '-c:v', 'libx264',
      '-preset', FFMPEG_PRESET,
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      targetPath,
    ]);
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr = (stderr + d.toString()).slice(-2000);
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(targetPath);
      else reject(new Error(`720p transcode failed (code ${code}): ${stderr}`));
    });
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isDownload = searchParams.get('download') === 'true';
    const isProduction = isCleanupEnabled();

    const masterPath = path.join(process.cwd(), 'generated', 'output.mp4');

    if (!fs.existsSync(masterPath)) {
      return new NextResponse('Video not found. Please click Generate first.', { status: 404 });
    }

    const filePath =
      searchParams.get('quality') === '720' ? await ensure720p(masterPath) : masterPath;

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
