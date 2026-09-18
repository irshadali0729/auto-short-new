import { NextResponse } from "next/server";
import type { ChildProcess } from "child_process";

interface ProgressData {
  complete: boolean;
  error: string | null;
  videoPath: string | null;
}

interface JobControl {
  processes: Set<ChildProcess>;
  tempDir: string;
  cancelled: boolean;
}

interface CustomGlobal {
  videoProgress?: Map<string, ProgressData>;
  videoJobControl?: Map<string, JobControl>;
}

export async function POST(request: Request) {
  try {
    const { runId } = await request.json();
    if (!runId || typeof runId !== "string") {
      return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }

    const customGlobal = global as unknown as CustomGlobal;
    const control = customGlobal.videoJobControl?.get(runId);

    if (!control) {
      return NextResponse.json(
        { error: "Job not found or already finished." },
        { status: 404 },
      );
    }

    control.cancelled = true;
    for (const proc of control.processes) {
      try {
        proc.kill("SIGTERM");
      } catch {}
    }

    customGlobal.videoProgress?.set(runId, {
      complete: true,
      error: "Video generation cancelled.",
      videoPath: null,
    });

    return NextResponse.json({ cancelled: true });
  } catch (error: unknown) {
    console.error("Error cancelling video generation job:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
