import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const ffmpegPath = ffmpegInstaller.path;

export async function POST(request: Request) {
  let tempDir = '';
  try {
    const { scenes } = await request.json();

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: 'Scenes list is required to generate the video.' }, { status: 400 });
    }

    const projectRoot = process.cwd();
    const imageLibraryDir = path.join(projectRoot, 'image-library');
    const generatedDir = path.join(projectRoot, 'generated');

    // Ensure generated directory exists
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    // Create unique temp directory for this compile run to avoid conflicts
    const runId = Date.now();
    tempDir = path.join(generatedDir, `temp_run_${runId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const clipPaths: string[] = [];

    // Compile each image scene into an MP4 clip
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imageFilename = scene.image;
      const duration = scene.duration || 5;

      const inputImagePath = path.join(imageLibraryDir, imageFilename);
      if (!fs.existsSync(inputImagePath)) {
        throw new Error(`Image asset "${imageFilename}" not found in image library.`);
      }

      const clipOutputPath = path.join(tempDir, `clip_${i}.mp4`);
      clipPaths.push(clipOutputPath);

      // FFmpeg filter graph: 1080x1920 layout, blur outer boundary (pillarbox/letterbox blur)
      const filterGraph = '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg];[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2';

      const ffmpegArgs = [
        '-y',
        '-loop', '1',
        '-i', inputImagePath,
        '-t', duration.toString(),
        '-r', '30',
        '-filter_complex', filterGraph,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        clipOutputPath
      ];

      await runFFmpegProcess(ffmpegArgs);
    }

    // Create concat.txt path list for FFmpeg demuxer
    const concatTxtPath = path.join(tempDir, 'concat.txt');
    const concatContent = clipPaths
      .map(p => `file '${p.replace(/\\/g, '/')}'`)
      .join('\n');

    fs.writeFileSync(concatTxtPath, concatContent);

    // Target video output filename
    const outputVideoPath = path.join(generatedDir, 'output.mp4');

    const concatArgs = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatTxtPath,
      '-c', 'copy',
      outputVideoPath
    ];

    await runFFmpegProcess(concatArgs);

    // Clean up temporary compilation artifacts
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn('Temporary directory cleanup failed:', cleanupErr);
    }

    return NextResponse.json({ videoPath: `/api/video?t=${Date.now()}` });

  } catch (error: unknown) {
    console.error('Error generating video via FFmpeg:', error);
    // Cleanup on failure
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Safe empty catch
      }
    }
    const errorMessage = error instanceof Error ? error.message : 'FFmpeg compilation failed.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

function runFFmpegProcess(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`Executing FFmpeg: ${ffmpegPath} ${args.join(' ')}`);
    const proc = spawn(ffmpegPath, args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stderr);
      } else {
        reject(new Error(`FFmpeg exited with status ${code}. Stderr: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`FFmpeg start error: ${err.message}`));
    });
  });
}
