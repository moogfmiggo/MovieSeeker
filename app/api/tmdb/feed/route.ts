import { NextResponse } from "next/server";
import {
  discoverMovies,
  getPopularMovies,
  getWatchProvidersForMovies,
  TMDBConfigError,
  TMDBError,
} from "@/lib/tmdb";
import {
  filterMoviesByAllGenres,
  normalizeGenreIds,
  normalizeMoviePage,
} from "@/lib/movieSearch";
import { summarizeWatchProvidersByMovie } from "@/lib/watchProviders";
import { withTimeoutFallback } from "@/lib/timeout";

export const dynamic = "force-dynamic";

const WATCH_PROVIDERS_TIMEOUT_MS = 3000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const selectedGenreIds = normalizeGenreIds(searchParams.get("genres"));
  const requestedPage = normalizeMoviePage(searchParams.get("page"));

  try {
    const data =
      selectedGenreIds.length > 0
        ? await discoverMovies({
            genreIds: selectedGenreIds,
            genreMatch: "all",
            page: requestedPage,
          })
        : await getPopularMovies(requestedPage);
    const movies =
      selectedGenreIds.length > 0
        ? filterMoviesByAllGenres(data.results, selectedGenreIds)
        : data.results;
    const rawProviders = await withTimeoutFallback(
      getWatchProvidersForMovies(movies.map((movie) => movie.id)),
      WATCH_PROVIDERS_TIMEOUT_MS,
      {},
    );

    return NextResponse.json({
      results: movies,
      providers: summarizeWatchProvidersByMovie(rawProviders),
      page: data.page,
      totalPages: data.total_pages,
    });
  } catch (error) {
    if (error instanceof TMDBConfigError) {
      console.error("[tmdb feed] configuration error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (error instanceof TMDBError) {
      console.error("[tmdb feed] request failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error(
      "[tmdb feed] unexpected error:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
