import { PersonalizedDiscovery } from "@/components/PersonalizedDiscovery";
import { GenreSearchPanel } from "@/components/GenreSearchPanel";
import { getMovieGenres, getStreamingProviderCatalog, getTVGenres, TMDBError } from "@/lib/tmdb";
import { FALLBACK_GENRES, FALLBACK_TV_GENRES } from "@/lib/genres";
import { FALLBACK_STREAMING_PROVIDERS } from "@/lib/streamingProviders";
import type { TMDBGenre, TMDBWatchProvider } from "@/types/tmdb";

export default async function DiscoverPage() {
  const [movieGenresResult, seriesGenresResult, providersResult] = await Promise.allSettled([
    getMovieGenres(),
    getTVGenres(),
    getStreamingProviderCatalog(),
  ]);

  if (movieGenresResult.status === "rejected") {
    const error = movieGenresResult.reason;
    console.error(
      "[discover] live TMDB genre fetch unavailable, using fallback list:",
      error instanceof TMDBError ? error.message : "unknown error",
    );
  }
  const genres: TMDBGenre[] = movieGenresResult.status === "fulfilled"
    ? movieGenresResult.value.genres
    : FALLBACK_GENRES;
  const seriesGenres: TMDBGenre[] = seriesGenresResult.status === "fulfilled"
    ? seriesGenresResult.value.genres
    : FALLBACK_TV_GENRES;
  const streamingProviders: TMDBWatchProvider[] = providersResult.status === "fulfilled"
    ? providersResult.value
    : FALLBACK_STREAMING_PROVIDERS;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <GenreSearchPanel
        genres={genres}
        seriesGenres={seriesGenres}
        streamingProviders={streamingProviders}
      />
      <div className="mt-10">
        <PersonalizedDiscovery />
      </div>
    </main>
  );
}
