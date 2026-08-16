import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ytdl from '@distube/ytdl-core';
import { Groq } from 'groq-sdk';

const ffmpegPath = ffmpegInstaller.path;
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function POST(request: Request) {
  let tempDir = '';
  try {
    const { scenes, youtubeVideoId } = await request.json();

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

    // Use original durations (no overlap subtraction needed for concat demuxer)
    const adjustedScenes = scenes.map(s => {
      return {
        ...s,
        duration: Number(Number(s.duration || 5).toFixed(2))
      };
    });

    // 1. Download YouTube audio if video ID is present
    const audioPath = path.join(tempDir, 'audio.mp3');
    let hasAudio = false;
    let hasSubtitles = false;
    const srtPath = path.join(tempDir, 'subtitles.srt');

    if (youtubeVideoId && typeof youtubeVideoId === 'string' && youtubeVideoId.trim() !== '') {
      try {
        await downloadYoutubeAudio(youtubeVideoId, audioPath);
        hasAudio = fs.existsSync(audioPath);

        if (hasAudio) {
          // 2. Transcribe downloaded audio file via Groq Whisper API
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

    const clipPaths: string[] = [];

    // Compile each image scene into an MP4 clip with a zoompan and fade transition
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

      // Determine alternating zoom direction: zoom in (even) vs zoom out (odd)
      const isZoomIn = i % 2 === 0;
      const zoomExpression = isZoomIn 
        ? "min(1.0+on*0.0006,1.15)"
        : "max(1.15-on*0.0006,1.0)";

      // Setup a clean fade duration (e.g. 0.3s dip to black)
      const fadeDuration = 0.3;
      const startFadeOut = Math.max(0, duration - fadeDuration);

      // FFmpeg filter graph: 1080x1920 layout, blur background, overlay centered foreground, zoompan, fade-in, fade-out
      const filterGraph = 
        `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg];` +
        `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg_scaled];` +
        `[bg][fg_scaled]overlay=(W-w)/2:(H-h)/2[merged];` +
        `[merged]zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2':d=1:s=1080x1920:fps=30[zoomed];` +
        `[zoomed]fade=t=in:st=0:d=${fadeDuration},fade=t=out:st=${startFadeOut.toFixed(2)}:d=${fadeDuration}`;

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

    // Temporary concatenated file path
    const mergedVideoPath = path.join(tempDir, 'merged_video.mp4');

    // Concat all compiled clips using the fast concat demuxer
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

    // Target final video output filename
    const outputVideoPath = path.join(generatedDir, 'output.mp4');

    // Run final burn-in/mux pass if audio or subtitles exist, otherwise just copy
    if (hasAudio || hasSubtitles) {
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
      fs.copyFileSync(mergedVideoPath, outputVideoPath);
    }

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
