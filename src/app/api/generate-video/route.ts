import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { cleanupAssets } from '@/app/utils/cleanup';

const ffmpegPath = ffmpegInstaller.path;

// Setup global progress map
if (!(global as any).videoProgress) {
  (global as any).videoProgress = new Map();
}
const progressMap = (global as any).videoProgress;

export async function POST(request: Request) {
  try {
    const { scenes, runId, zoomSpeed, transitionDuration } = await request.json();

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: 'Scenes list is required to generate the video.' }, { status: 400 });
    }

    if (!runId) {
      return NextResponse.json({ error: 'runId is required for status tracking.' }, { status: 400 });
    }

    const zoomSpeedMultiplier = typeof zoomSpeed === 'number' ? zoomSpeed : 1.0;
    const transitionDurationSec = typeof transitionDuration === 'number' ? transitionDuration : 0.3;

    // Set initial progress status
    progressMap.set(runId, {
      complete: false,
      error: null,
      videoPath: null
    });

    // Start background video compilation
    compileVideoInBackground(
      runId,
      scenes,
      zoomSpeedMultiplier,
      transitionDurationSec
    ).catch(err => {
      console.error('Background compilation crash:', err);
      progressMap.set(runId, {
        complete: true,
        error: err.message || 'Background compilation failed.',
        videoPath: null
      });
    });

    return NextResponse.json({ runId });

  } catch (error: any) {
    console.error('Error starting video generation:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

async function compileVideoInBackground(
  runId: string,
  scenes: any[],
  zoomSpeedMultiplier: number,
  transitionDuration: number
) {
  let tempDir = '';
  try {
    const projectRoot = process.cwd();
    const imageLibraryDir = path.join(projectRoot, 'image-library');
    const generatedDir = path.join(projectRoot, 'generated');

    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    const tempRunId = Date.now();
    tempDir = path.join(generatedDir, `temp_run_${tempRunId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const adjustedScenes = scenes.map(s => {
      return {
        ...s,
        duration: Number(Number(s.duration || 5).toFixed(2))
      };
    });

    const clipPaths: string[] = [];

    for (let i = 0; i < adjustedScenes.length; i++) {
      const scene = adjustedScenes[i];
      const imageFilename = scene.image;
      const duration = scene.duration;

      const inputImagePath = path.join(imageLibraryDir, imageFilename);
      if (!fs.existsSync(inputImagePath)) {
        throw new Error(`Image asset "${imageFilename}" not found in image library.`);
      }

      const clipOutputPath = path.join(tempDir, `clip_${i}.mp4`);
      clipPaths.push(clipOutputPath);

      const isZoomIn = i % 2 === 0;
      const speedStep = 0.0006 * zoomSpeedMultiplier;
      const zoomExpression = isZoomIn 
        ? `min(1.0+on*${speedStep},1.15)`
        : `max(1.15-on*${speedStep},1.0)`;

      const sceneFade = Math.min(transitionDuration, duration / 2);
      
      let filterGraph = 
        `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg];` +
        `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg_scaled];` +
        `[bg][fg_scaled]overlay=(W-w)/2:(H-h)/2[merged];` +
        `[merged]zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2':d=1:s=1080x1920:fps=30`;

      if (sceneFade > 0) {
        filterGraph += `[zoomed];[zoomed]fade=t=in:st=0:d=${sceneFade},fade=t=out:st=${(duration - sceneFade).toFixed(2)}:d=${sceneFade}`;
      }

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

    const mergedVideoPath = path.join(tempDir, 'merged_video.mp4');
    const concatTxtPath = path.join(tempDir, 'concat.txt');
    const concatContent = clipPaths
      .map(p => `file '${p.replace(/\\/g, '/')}'`)
      .join('\n');

    fs.writeFileSync(concatTxtPath, concatContent);

    const concatArgs = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatTxtPath,
      '-c', 'copy',
      mergedVideoPath
    ];

    await runFFmpegProcess(concatArgs);

    const outputVideoPath = path.join(generatedDir, 'output.mp4');
    fs.copyFileSync(mergedVideoPath, outputVideoPath);

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn('Temporary directory cleanup failed:', cleanupErr);
    }

    // Set background status to complete
    progressMap.set(runId, {
      complete: true,
      error: null,
      videoPath: `/api/video?t=${Date.now()}`
    });

    const isProduction = process.env.NODE_ENV === 'production' || process.env.CLEANUP_ASSETS === 'true';
    if (isProduction) {
      setTimeout(() => {
        cleanupAssets();
      }, 10 * 60 * 1000); // 10 minutes timeout
    }

  } catch (error: any) {
    console.error('Error generating video via FFmpeg in background:', error);
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
    const errorMessage = error instanceof Error ? error.message : 'FFmpeg compilation failed.';
    progressMap.set(runId, {
      complete: true,
      error: errorMessage,
      videoPath: null
    });
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
