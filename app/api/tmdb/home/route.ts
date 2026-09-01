import { NextResponse } from "next/server";
import {
  getNowPlayingMovies,
  getStreamingMovies,
  TMDBConfigError,
  TMDBError,
} from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [streamingResult, nowPlayingResult] = await Promise.allSettled([
      getStreamingMovies(),
      getNowPlayingMovies(),
    ]);

    if (streamingResult.status === "rejected" && nowPlayingResult.status === "rejected") {
      throw streamingResult.reason;
    }
    if (streamingResult.status === "rejected") {
      console.error(
        "[home discovery] streaming lookup failed:",
        streamingResult.reason instanceof Error ? streamingResult.reason.message : "unknown error",
      );
    }
    if (nowPlayingResult.status === "rejected") {
      console.error(
        "[home discovery] Thailand now-playing lookup failed:",
        nowPlayingResult.reason instanceof Error ? nowPlayingResult.reason.message : "unknown error",
      );
    }

    return NextResponse.json({
      streaming:
        streamingResult.status === "fulfilled" ? streamingResult.value.results : [],
      nowPlaying:
        nowPlayingResult.status === "fulfilled" ? nowPlayingResult.value.results : [],
    });
  } catch (error) {
    if (error instanceof TMDBConfigError) {
      console.error("[home discovery] configuration error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (error instanceof TMDBError) {
      console.error("[home discovery] TMDB request failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error(
      "[home discovery] unexpected error:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
