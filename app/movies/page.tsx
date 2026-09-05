import {
  discoverMovies,
  discoverTVSeries,
  getMovieGenres,
  getPopularMovies,
  getStreamingProviderCatalog,
  getTVGenres,
  getWatchProvidersForMovies,
  getWatchProvidersForTVSeries,
  resolveMovieTopicKeywordIds,
  TMDBError,
} from "@/lib/tmdb";
import { summarizeWatchProvidersByMovie } from "@/lib/watchProviders";
import { withTimeoutFallback } from "@/lib/timeout";
import { filterMoviesByAllGenres, normalizeGenreIds } from "@/lib/movieSearch";
import { normalizeTopicSlugs } from "@/lib/movieTopics";
import { normalizeStreamingProviderIds, FALLBACK_STREAMING_PROVIDERS } from "@/lib/streamingProviders";
import { MovieList } from "@/components/MovieList";
import { GenreSearchPanel } from "@/components/GenreSearchPanel";
import { TitleSearchPanel } from "@/components/TitleSearchPanel";
import { FALLBACK_GENRES, FALLBACK_TV_GENRES } from "@/lib/genres";
import { th } from "@/lib/i18n";
import type { TMDBGenre, TMDBPopularMoviesResponse, TMDBWatchProvider } from "@/types/tmdb";

export const dynamic = "force-dynamic";

const WATCH_PROVIDERS_TIMEOUT_MS = 3000;

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{
    genres?: string | string[];
    topics?: string | string[];
    providers?: string | string[];
    seriesGenres?: string | string[];
    seriesTopics?: string | string[];
  }>;
}) {
  const currentSearch = await searchParams;
  const selectedGenreIds = normalizeGenreIds(currentSearch.genres);
  const selectedTopicSlugs = normalizeTopicSlugs(currentSearch.topics);
  const selectedProviderIds = normalizeStreamingProviderIds(currentSearch.providers);
  const selectedSeriesGenreIds = normalizeGenreIds(currentSearch.seriesGenres);
  const selectedSeriesTopicSlugs = normalizeTopicSlugs(currentSearch.seriesTopics);

  const hasMovieChoice = selectedGenreIds.length > 0 || selectedTopicSlugs.length > 0;
  const includeSeries =
    selectedSeriesGenreIds.length > 0 || selectedSeriesTopicSlugs.length > 0;
  // Movies are the default. A series-only genre selection is the one case
  // where the movie section is omitted rather than padded with generic titles.
  const includeMovies = hasMovieChoice || !includeSeries;

  let movieData: TMDBPopularMoviesResponse | null = null;
  let seriesData: TMDBPopularMoviesResponse | null = null;

  try {
    const [keywordIds, seriesKeywordIds] = await Promise.all([
      includeMovies ? resolveMovieTopicKeywordIds(selectedTopicSlugs) : [],
      includeSeries ? resolveMovieTopicKeywordIds(selectedSeriesTopicSlugs) : [],
    ]);
    [movieData, seriesData] = await Promise.all([
      includeMovies
        ? hasMovieChoice || selectedProviderIds.length > 0
          ? discoverMovies({
              genreIds: selectedGenreIds,
              genreMatch: "all",
              keywordIds,
              keywordMatch: "all",
              providerIds: selectedProviderIds,
              sortByRating: true,
            }).then((data) => ({
              ...data,
              results: filterMoviesByAllGenres(data.results, selectedGenreIds),
            }))
          : getPopularMovies()
        : Promise.resolve(null),
      includeSeries
        ? discoverTVSeries({
            genreIds: selectedSeriesGenreIds,
            genreMatch: "all",
            keywordIds: seriesKeywordIds,
            keywordMatch: "all",
            providerIds: selectedProviderIds,
          }).then((data) => ({
            ...data,
            results: filterMoviesByAllGenres(data.results, selectedSeriesGenreIds),
          }))
        : Promise.resolve(null),
    ]);
  } catch (error) {
    console.error(
      "[movies] failed to load catalog:",
      error instanceof Error ? error.message : "unknown error",
    );
    throw new Error("Unable to load movies or series right now.");
  }

  const [movieGenresResult, seriesGenresResult, providerCatalogResult] = await Promise.allSettled([
    getMovieGenres(),
    getTVGenres(),
    getStreamingProviderCatalog(),
  ]);
  const genres: TMDBGenre[] = movieGenresResult.status === "fulfilled"
    ? movieGenresResult.value.genres
    : FALLBACK_GENRES;
  const seriesGenres: TMDBGenre[] = seriesGenresResult.status === "fulfilled"
    ? seriesGenresResult.value.genres
    : FALLBACK_TV_GENRES;
  const streamingProviders: TMDBWatchProvider[] = providerCatalogResult.status === "fulfilled"
    ? providerCatalogResult.value
    : FALLBACK_STREAMING_PROVIDERS;

  if (movieGenresResult.status === "rejected") {
    const error = movieGenresResult.reason;
    console.error(
      "[movies] live TMDB genre fetch unavailable, using fallback list:",
      error instanceof TMDBError ? error.message : "unknown error",
    );
  }

  const movieProviders = movieData
    ? summarizeWatchProvidersByMovie(await withTimeoutFallback(
        getWatchProvidersForMovies(movieData.results.map((movie) => movie.id)),
        WATCH_PROVIDERS_TIMEOUT_MS,
        {},
      ))
    : {};
  const seriesProviders = seriesData
    ? summarizeWatchProvidersByMovie(await withTimeoutFallback(
        getWatchProvidersForTVSeries(seriesData.results.map((series) => series.id)),
        WATCH_PROVIDERS_TIMEOUT_MS,
        {},
      ))
    : {};

  const selectedMovieFilterCount = selectedGenreIds.length + selectedTopicSlugs.length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <TitleSearchPanel />
      <div className="mt-6">
        <GenreSearchPanel
          genres={genres}
          seriesGenres={seriesGenres}
          streamingProviders={streamingProviders}
          initialSelectedGenreIds={selectedGenreIds}
          initialSelectedTopicSlugs={selectedTopicSlugs}
          initialSelectedProviderIds={selectedProviderIds}
          initialSelectedSeriesGenreIds={selectedSeriesGenreIds}
          initialSelectedSeriesTopicSlugs={selectedSeriesTopicSlugs}
        />
      </div>

      {movieData && (
        <section className="mt-10">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {selectedMovieFilterCount > 0 || selectedProviderIds.length > 0
              ? th.moviesPage.movieResultsTitle
              : th.moviesPage.title}
          </h1>
          <p className="mt-1 text-sm opacity-70">
            {selectedMovieFilterCount > 0
              ? th.moviesPage.filteredSubtitle(selectedMovieFilterCount)
              : selectedProviderIds.length > 0
                ? th.genreSearch.streamingProvidersHint
                : th.moviesPage.subtitle}
          </p>
          <MovieList
            key={`movie|${selectedGenreIds.join(",")}|${selectedTopicSlugs.join(",")}|${selectedProviderIds.join(",")}`}
            movies={movieData.results}
            providersByMovieId={movieProviders}
            selectedGenreIds={selectedGenreIds}
            selectedTopicSlugs={selectedTopicSlugs}
            selectedProviderIds={selectedProviderIds}
            selectedSeriesGenreIds={selectedSeriesGenreIds}
            selectedSeriesTopicSlugs={selectedSeriesTopicSlugs}
            initialPage={movieData.page}
            totalPages={movieData.total_pages}
          />
        </section>
      )}

      {seriesData && (
        <section className="mt-12 border-t border-border pt-10">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {th.moviesPage.seriesResultsTitle}
          </h1>
          <p className="mt-1 text-sm opacity-70">
            {th.moviesPage.seriesResultsSubtitle(
              selectedSeriesGenreIds.length + selectedSeriesTopicSlugs.length,
            )}
          </p>
          <MovieList
            key={`tv|${selectedSeriesGenreIds.join(",")}|${selectedSeriesTopicSlugs.join(",")}|${selectedProviderIds.join(",")}`}
            movies={seriesData.results}
            providersByMovieId={seriesProviders}
            selectedProviderIds={selectedProviderIds}
            selectedSeriesGenreIds={selectedSeriesGenreIds}
            selectedSeriesTopicSlugs={selectedSeriesTopicSlugs}
            mediaType="tv"
            emptyMessage={th.movieList.noSeriesFound}
            initialPage={seriesData.page}
            totalPages={seriesData.total_pages}
          />
        </section>
      )}
    </main>
  );
}
