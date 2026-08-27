import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId) {
      return NextResponse.json({ error: 'runId is required' }, { status: 400 });
    }

    if (!(global as any).videoProgress) {
      (global as any).videoProgress = new Map();
    }
    const progressMap = (global as any).videoProgress;
    const progressData = progressMap.get(runId);

    if (!progressData) {
      return NextResponse.json({ progress: 0, status: 'Not started or expired' });
    }

    return NextResponse.json(progressData);
  } catch (error: any) {
    console.error('Error fetching progress:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
