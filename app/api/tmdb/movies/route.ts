import { NextResponse } from "next/server";
import { getMoviesByIds, getWatchProvidersForMovies, TMDBConfigError, TMDBError } from "@/lib/tmdb";
import { summarizeWatchProvidersByMovie } from "@/lib/watchProviders";

// Always fetch live from TMDB at request time — never statically cached at build time.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((raw) => Number(raw.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (ids.length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    const movies = await getMoviesByIds(ids);
    // Never throws - see getWatchProvidersForMovies. A provider lookup
    // failure must not turn a successful movie lookup into a 502.
    const rawProviders = await getWatchProvidersForMovies(movies.map((movie) => movie.id));
    const providers = summarizeWatchProvidersByMovie(rawProviders);
    return NextResponse.json({ results: movies, providers });
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
