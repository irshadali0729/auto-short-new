import { NextResponse } from "next/server";
import { loadCtaLibrary } from "@/app/utils/cta-library";

// Lists the subscribe/share/bell animations in image-library/cta/ with their
// lengths, for the Subscribe settings picker and the storyboard preview.
export async function GET() {
  try {
    return NextResponse.json({ library: await loadCtaLibrary() });
  } catch (error) {
    console.error("Error listing CTA animations:", error);
    return NextResponse.json({ error: "Failed to list CTA animations." }, { status: 500 });
  }
}
