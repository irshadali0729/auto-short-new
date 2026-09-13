import { NextResponse } from 'next/server';
import { getHostVideos } from '@/app/utils/host-library';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hostType = searchParams.get('type') || 'women_host';

    const hosts = getHostVideos(hostType);
    return NextResponse.json({
      hosts,
      total: hosts.length,
      hostType,
    });
  } catch (error) {
    console.error('Error listing host videos:', error);
    return NextResponse.json(
      { error: 'Failed to list host videos' },
      { status: 500 }
    );
  }
}
