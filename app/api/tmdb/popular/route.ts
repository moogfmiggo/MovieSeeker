import { NextResponse } from "next/server";
import { getPopularMovies, TMDBConfigError, TMDBError } from "@/lib/tmdb";

// This endpoint always hits TMDB live — never statically cached at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getPopularMovies();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof TMDBConfigError) {
      console.error("[tmdb] configuration error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (error instanceof TMDBError) {
      console.error("[tmdb] request failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error(
      "[tmdb] unexpected error:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
