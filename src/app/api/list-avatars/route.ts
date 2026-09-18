import { NextResponse } from 'next/server';
import { listAvatars, getAvatarVideos } from '@/app/utils/avatar-library';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'women_avatars';

    // ?videos=1 → flat list of every avatar video path in the category (for the host replace picker)
    if (searchParams.get('videos')) {
      const videos = listAvatars(category).flatMap((a) =>
        getAvatarVideos(category, a.id).map((v) => v.relativePath),
      );
      return NextResponse.json({ videos, total: videos.length, category });
    }

    const avatars = listAvatars(category);
    return NextResponse.json({
      avatars,
      total: avatars.length,
      category,
    });
  } catch (error) {
    console.error('Error listing avatars:', error);
    return NextResponse.json(
      { error: 'Failed to list avatars' },
      { status: 500 }
    );
  }
}
