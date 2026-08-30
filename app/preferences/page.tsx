import { getMovieGenres, TMDBError } from "@/lib/tmdb";
import { PreferencesForm } from "@/components/PreferencesForm";
import type { TMDBGenre } from "@/types/tmdb";
import { FALLBACK_GENRES } from "@/lib/genres";
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
        <PreferencesForm genres={genres} />
      </div>
    </main>
  );
}
