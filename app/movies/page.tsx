import {
  discoverMovies,
  getMovieGenres,
  getPopularMovies,
  getWatchProvidersForMovies,
  resolveMovieTopicKeywordIds,
  TMDBError,
} from "@/lib/tmdb";
import { summarizeWatchProvidersByMovie } from "@/lib/watchProviders";
import { withTimeoutFallback } from "@/lib/timeout";
import { filterMoviesByAllGenres, normalizeGenreIds } from "@/lib/movieSearch";
import { normalizeTopicSlugs } from "@/lib/movieTopics";
import { MovieList } from "@/components/MovieList";
import { GenreSearchPanel } from "@/components/GenreSearchPanel";
import { FALLBACK_GENRES } from "@/lib/genres";
import { th } from "@/lib/i18n";
import type { TMDBGenre, TMDBPopularMoviesResponse } from "@/types/tmdb";

// Always fetch live from TMDB at request time — never prerendered at build time.
export const dynamic = "force-dynamic";

// Watch-provider enrichment is nice-to-have (badges), not core content - if
// TMDB is slow to answer for the ~20 movies on this page, the grid must
// still render on time with no badges rather than wait indefinitely.
const WATCH_PROVIDERS_TIMEOUT_MS = 3000;

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{
    genres?: string | string[];
    topics?: string | string[];
  }>;
}) {
  const currentSearch = await searchParams;
  const selectedGenreIds = normalizeGenreIds(currentSearch.genres);
  const selectedTopicSlugs = normalizeTopicSlugs(currentSearch.topics);
  const selectedFilterCount = selectedGenreIds.length + selectedTopicSlugs.length;
  const hasFilters = selectedFilterCount > 0;
  let movieData: TMDBPopularMoviesResponse;
  let genres: TMDBGenre[];

  try {
    if (hasFilters) {
      const keywordIds = await resolveMovieTopicKeywordIds(selectedTopicSlugs);
      const data = await discoverMovies({
        genreIds: selectedGenreIds,
        genreMatch: "all",
        keywordIds,
        keywordMatch: "all",
      });
      movieData = {
        ...data,
        results: filterMoviesByAllGenres(data.results, selectedGenreIds),
      };
    } else {
      movieData = await getPopularMovies();
    }
  } catch (error) {
    // Full detail (still token-free) goes to server logs only. The client
    // only ever sees the generic message thrown below, via app/movies/error.tsx.
    console.error(
      "[movies] failed to load movies:",
      error instanceof Error ? error.message : "unknown error",
    );
    throw new Error("Unable to load movies right now.");
  }

  try {
    genres = (await getMovieGenres()).genres;
  } catch (error) {
    console.error(
      "[movies] live TMDB genre fetch unavailable, using fallback list:",
      error instanceof TMDBError ? error.message : "unknown error",
    );
    genres = FALLBACK_GENRES;
  }

  const movies = movieData.results;

  // Never throws on its own (see getWatchProvidersForMovies) - a provider
  // lookup failure for one or all movies just means no badges are shown.
  // withTimeoutFallback bounds how long we additionally wait for it to
  // finish: past WATCH_PROVIDERS_TIMEOUT_MS, we proceed with {} (no
  // badges) rather than let a slow TMDB response hold up the whole page -
  // it must never take down or stall the movies page.
  const rawProviders = await withTimeoutFallback(
    getWatchProvidersForMovies(movies.map((movie) => movie.id)),
    WATCH_PROVIDERS_TIMEOUT_MS,
    {},
  );
  const providersByMovieId = summarizeWatchProvidersByMovie(rawProviders);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <GenreSearchPanel
        genres={genres}
        initialSelectedGenreIds={selectedGenreIds}
        initialSelectedTopicSlugs={selectedTopicSlugs}
      />

      <section className="mt-10">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {hasFilters ? th.moviesPage.filteredTitle : th.moviesPage.title}
        </h1>
        <p className="mt-1 text-sm opacity-70">
          {hasFilters
            ? th.moviesPage.filteredSubtitle(selectedFilterCount)
            : th.moviesPage.subtitle}
        </p>
        <MovieList
          key={`${selectedGenreIds.join(",")}|${selectedTopicSlugs.join(",")}`}
          movies={movies}
          providersByMovieId={providersByMovieId}
          selectedGenreIds={selectedGenreIds}
          selectedTopicSlugs={selectedTopicSlugs}
          initialPage={movieData.page}
          totalPages={movieData.total_pages}
        />
      </section>
    </main>
  );
}
