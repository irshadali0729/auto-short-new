import { NextResponse } from 'next/server';

interface CustomGlobal {
  videoProgress?: Map<string, { complete: boolean; error: string | null; videoPath: string | null }>;
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
      return NextResponse.json({ complete: false, error: 'Job not found or expired', videoPath: null });
    }

    return NextResponse.json(progressData);
  } catch (error: unknown) {
    console.error('Error fetching progress:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

