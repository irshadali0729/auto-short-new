import { NextResponse } from 'next/server';

interface ProgressData {
  complete: boolean;
  error: string | null;
  videoPath: string | null;
  stage?: "preparing" | "rendering_scenes" | "merging" | "done";
  scenesCompleted?: number;
  totalScenes?: number;
}

interface CustomGlobal {
  videoProgress?: Map<string, ProgressData>;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId) {
      return NextResponse.json({ error: 'runId is required' }, { status: 400 });
    }

    const customGlobal = global as unknown as CustomGlobal;
    if (!customGlobal.videoProgress) {
      customGlobal.videoProgress = new Map();
    }
    const progressMap = customGlobal.videoProgress;
    const progressData = progressMap.get(runId);

    if (!progressData) {
      // `found: false` lets the client tell "job genuinely not started yet"
      // apart from "still rendering" instead of polling forever in silence.
      return NextResponse.json({ complete: false, found: false, error: 'Job not found or expired', videoPath: null });
    }

    return NextResponse.json({ found: true, ...progressData });
  } catch (error: unknown) {
    console.error('Error fetching progress:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

