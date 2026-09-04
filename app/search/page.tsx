import { MovieList } from "@/components/MovieList";
import { TitleSearchPanel } from "@/components/TitleSearchPanel";
import {
  getWatchProvidersForMovies,
  getWatchProvidersForTVSeries,
  searchMovies,
  searchTVSeries,
} from "@/lib/tmdb";
import { th } from "@/lib/i18n";
import {
  normalizeTitleSearchMediaType,
  normalizeTitleSearchQuery,
} from "@/lib/titleSearch";
import { summarizeWatchProvidersByMovie } from "@/lib/watchProviders";
import { withTimeoutFallback } from "@/lib/timeout";
import type { TMDBPopularMoviesResponse } from "@/types/tmdb";

export const dynamic = "force-dynamic";

const WATCH_PROVIDERS_TIMEOUT_MS = 3000;
const EMPTY_RESULTS: TMDBPopularMoviesResponse = {
  page: 1,
  results: [],
  total_pages: 1,
  total_results: 0,
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; mediaType?: string | string[] }>;
}) {
  const currentSearch = await searchParams;
  const query = normalizeTitleSearchQuery(currentSearch.q);
  const mediaType = normalizeTitleSearchMediaType(currentSearch.mediaType);

  let data = EMPTY_RESULTS;
  if (query) {
    try {
      data = mediaType === "tv"
        ? await searchTVSeries(query)
        : await searchMovies(query);
    } catch (error) {
      console.error(
        "[title search] failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      throw new Error("Unable to search titles right now.");
    }
  }

  const rawProviders = query
    ? await withTimeoutFallback(
        mediaType === "tv"
          ? getWatchProvidersForTVSeries(data.results.map((item) => item.id))
          : getWatchProvidersForMovies(data.results.map((item) => item.id)),
        WATCH_PROVIDERS_TIMEOUT_MS,
        {},
      )
    : {};
  const providers = summarizeWatchProvidersByMovie(rawProviders);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <TitleSearchPanel
        initialQuery={query}
        initialMediaType={mediaType}
        compact
      />

      <section className="mt-10">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {query
            ? mediaType === "tv"
              ? th.titleSearch.seriesResults(query)
              : th.titleSearch.movieResults(query)
            : th.titleSearch.emptyPrompt}
        </h1>
        {query && data.results.length > 0 && (
          <p className="mt-1 text-sm opacity-70">{th.titleSearch.resultCount(data.total_results)}</p>
        )}
        {query && (
          <MovieList
            key={`${mediaType}|${query}`}
            movies={data.results}
            providersByMovieId={providers}
            mediaType={mediaType}
            searchQuery={query}
            emptyMessage={th.titleSearch.noResults}
            initialPage={data.page}
            totalPages={data.total_pages}
          />
        )}
      </section>
    </main>
  );
}
