import { NextResponse } from 'next/server';
import { listAvatars } from '@/app/utils/avatar-library';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'women_avatars';

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
