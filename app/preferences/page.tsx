import { getMovieGenres, getStreamingProviderCatalog, getTVGenres, TMDBError } from "@/lib/tmdb";
import { GenreSearchForm } from "@/components/GenreSearchForm";
import type { TMDBGenre } from "@/types/tmdb";
import { FALLBACK_GENRES, FALLBACK_TV_GENRES } from "@/lib/genres";
import { FALLBACK_STREAMING_PROVIDERS } from "@/lib/streamingProviders";
import { th } from "@/lib/i18n";

export default async function PreferencesPage() {
  let genres: TMDBGenre[];

  try {
    const data = await getMovieGenres();
    genres = data.genres;
  } catch (error) {
    console.error(
      "[preferences] live TMDB genre fetch unavailable, using fallback list:",
      error instanceof TMDBError ? error.message : "unknown error",
    );
    genres = FALLBACK_GENRES;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{th.preferencesPage.title}</h1>
      <p className="mt-1 text-sm opacity-70">{th.preferencesPage.subtitle}</p>
      <div className="mt-6">
        <GenreSearchForm
          genres={genres}
          seriesGenres={(await getTVGenres().catch(() => ({ genres: FALLBACK_TV_GENRES }))).genres}
          streamingProviders={await getStreamingProviderCatalog().catch(() => FALLBACK_STREAMING_PROVIDERS)}
        />
      </div>
    </main>
  );
}
