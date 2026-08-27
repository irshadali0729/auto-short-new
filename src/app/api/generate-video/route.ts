import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ytdl from '@distube/ytdl-core';
import { Groq } from 'groq-sdk';
import { cleanupAssets } from '@/app/utils/cleanup';

const ffmpegPath = ffmpegInstaller.path;
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Setup global progress map
if (!(global as any).videoProgress) {
  (global as any).videoProgress = new Map();
}
const progressMap = (global as any).videoProgress;

export async function POST(request: Request) {
  try {
    const { scenes, youtubeVideoId, runId, zoomSpeed, transitionDuration } = await request.json();

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: 'Scenes list is required to generate the video.' }, { status: 400 });
    }

    if (!runId) {
      return NextResponse.json({ error: 'runId is required for progress tracking.' }, { status: 400 });
    }

    const zoomSpeedMultiplier = typeof zoomSpeed === 'number' ? zoomSpeed : 1.0;
    const transitionDurationSec = typeof transitionDuration === 'number' ? transitionDuration : 0.3;

    // Initialize progress state
    progressMap.set(runId, {
      progress: 0,
      status: 'Initializing video generation process...',
      error: null,
      videoPath: null
    });

    // Start background video compilation
    compileVideoInBackground(
      runId,
      scenes,
      youtubeVideoId,
      zoomSpeedMultiplier,
      transitionDurationSec
    ).catch(err => {
      console.error('Background compilation crash:', err);
      progressMap.set(runId, {
        progress: 100,
        status: 'Failed to compile video',
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
  youtubeVideoId: string | undefined,
  zoomSpeedMultiplier: number,
  transitionDuration: number
) {
  const updateProgress = (progress: number, status: string, error: string | null = null, videoPath: string | null = null) => {
    progressMap.set(runId, { progress, status, error, videoPath });
  };

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

    const audioPath = path.join(tempDir, 'audio.mp3');
    let hasAudio = false;
    let hasSubtitles = false;
    const srtPath = path.join(tempDir, 'subtitles.srt');

    if (youtubeVideoId && typeof youtubeVideoId === 'string' && youtubeVideoId.trim() !== '') {
      updateProgress(5, 'Downloading voiceover audio from YouTube...');
      try {
        await downloadYoutubeAudio(youtubeVideoId, audioPath);
        hasAudio = fs.existsSync(audioPath);

        if (hasAudio) {
          updateProgress(12, 'Transcribing voiceover audio with Groq Whisper...');
          try {
            const srtContent = await transcribeAudio(audioPath);
            if (srtContent && typeof srtContent === 'string' && srtContent.trim() !== '') {
              fs.writeFileSync(srtPath, srtContent, 'utf-8');
              hasSubtitles = fs.existsSync(srtPath);
              console.log(`Synced SRT Subtitles generated via Whisper at: ${srtPath}`);
            }
          } catch (transcribeErr) {
            console.error('Failed to transcribe audio via Groq Whisper API:', transcribeErr);
          }
        }
      } catch (audioErr) {
        console.error('Failed to download YouTube audio, will proceed without voiceover:', audioErr);
      }
    }

    updateProgress(20, 'Compiling storyboard scenes...');
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

      updateProgress(
        Math.round(20 + (i / adjustedScenes.length) * 60),
        `Compiling scene ${i + 1} of ${adjustedScenes.length} (${scene.keyword || 'clip'})...`
      );

      await runFFmpegProcess(ffmpegArgs);
    }

    updateProgress(82, 'Merging individual scene clips...');
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

    if (hasAudio || hasSubtitles) {
      updateProgress(90, 'Adding audio track and subtitles...');
      const finalArgs: string[] = ['-y', '-i', mergedVideoPath];

      if (hasAudio) {
        finalArgs.push('-i', audioPath);
      }

      if (hasSubtitles) {
        const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
        finalArgs.push(
          '-vf', `subtitles='${escapedSrtPath}':force_style='Alignment=2,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,MarginV=60'`
        );
      }

      finalArgs.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p');

      if (hasAudio) {
        finalArgs.push('-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-shortest');
      }

      finalArgs.push(outputVideoPath);
      await runFFmpegProcess(finalArgs);
    } else {
      updateProgress(95, 'Saving final video output file...');
      fs.copyFileSync(mergedVideoPath, outputVideoPath);
    }

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn('Temporary directory cleanup failed:', cleanupErr);
    }

    updateProgress(100, 'Video generation complete!', null, `/api/video?t=${Date.now()}`);

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
    updateProgress(100, 'Failed to compile video', errorMessage);
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

async function transcribeAudio(audioPath: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured in environment variables.');
  }

  console.log(`Transcribing audio file via Groq Whisper API: ${audioPath}`);
  const transcription = await groq.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-large-v3',
    response_format: 'srt' as 'json',
  });

  return transcription as unknown as string;
}

async function downloadYoutubeAudio(videoId: string, outputPath: string): Promise<void> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  return new Promise((resolve, reject) => {
    try {
      console.log(`Starting YouTube audio download for video ID: ${videoId}`);
      const stream = ytdl(url, {
        filter: 'audioonly',
        quality: 'highestaudio',
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        }
      });

      const writeStream = fs.createWriteStream(outputPath);

      stream.pipe(writeStream);

      writeStream.on('finish', () => {
        console.log(`YouTube audio downloaded successfully: ${outputPath}`);
        resolve();
      });

      writeStream.on('error', (err) => {
        console.error('Write stream error in YouTube audio download:', err);
        reject(err);
      });

      stream.on('error', (err) => {
        console.error('YTDL stream error in YouTube audio download:', err);
        reject(err);
      });
    } catch (err) {
      console.error('Failed to initialize YTDL download:', err);
      reject(err);
    }
  });
}
