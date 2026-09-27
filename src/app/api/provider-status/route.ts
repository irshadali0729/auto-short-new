import { NextResponse } from 'next/server';

// Reports which stock providers have an API key configured (never the keys
// themselves), so the settings UI can explain why a source returns nothing.
export async function GET() {
  return NextResponse.json({
    pexels: Boolean(process.env.PEXELS_API_KEY),
    unsplash: Boolean(process.env.UNSPLASH_ACCESS_KEY),
    pixabay: Boolean(process.env.PIXABAY_API_KEY),
  });
}
