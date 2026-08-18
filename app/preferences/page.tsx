import { getMovieGenres, TMDBError } from "@/lib/tmdb";
import { PreferencesForm } from "@/components/PreferencesForm";
import type { TMDBGenre } from "@/types/tmdb";

// TMDB's official movie genre list (id/name pairs are TMDB's own, stable for
// years). Used only if the live call can't complete - so this page still
// works without inventing a second, independent genre system.
const FALLBACK_GENRES: TMDBGenre[] = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" },
  { id: 10770, name: "TV Movie" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
];

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
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Movie Preferences</h1>
      <p className="mt-1 text-sm opacity-70">
        Pick the genres you like. We&apos;ll use this to personalize recommendations later.
      </p>
      <div className="mt-6">
        <PreferencesForm genres={genres} />
      </div>
    </main>
  );
}
