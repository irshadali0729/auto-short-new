import { NextResponse } from 'next/server';
import { readHistory, addHistoryEntry } from '@/app/utils/history-store';
import type { HistoryEntry } from '@/app/types/history';

export async function GET() {
  try {
    return NextResponse.json({ history: readHistory() });
  } catch (error: unknown) {
    console.error('Error reading history:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to read history.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { videoTitle, channelName, seo, savedFilename } = body || {};

    if (!seo || typeof seo !== 'object') {
      return NextResponse.json({ error: 'seo data is required.' }, { status: 400 });
    }

    const entry: HistoryEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      videoTitle: typeof videoTitle === 'string' && videoTitle ? videoTitle : 'Untitled Video',
      channelName: typeof channelName === 'string' && channelName ? channelName : 'Unknown Channel',
      createdAt: Date.now(),
      seo: {
        title: String(seo.title || ''),
        hashtags: Array.isArray(seo.hashtags) ? seo.hashtags.map(String) : [],
        description: String(seo.description || ''),
      },
      savedFilename: typeof savedFilename === 'string' ? savedFilename : undefined,
    };

    const history = addHistoryEntry(entry);
    return NextResponse.json({ history });
  } catch (error: unknown) {
    console.error('Error saving history entry:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to save history entry.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
