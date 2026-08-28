import { getPopularMovies, getWatchProvidersForMovies } from "@/lib/tmdb";
import { summarizeWatchProvidersByMovie } from "@/lib/watchProviders";
import { MovieList } from "@/components/MovieList";
import { th } from "@/lib/i18n";

// Always fetch live from TMDB at request time — never prerendered at build time.
export const dynamic = "force-dynamic";

export default async function MoviesPage() {
  let movies;

  try {
    const data = await getPopularMovies();
    movies = data.results;
  } catch (error) {
    // Full detail (still token-free) goes to server logs only. The client
    // only ever sees the generic message thrown below, via app/movies/error.tsx.
    console.error(
      "[movies] failed to load popular movies:",
      error instanceof Error ? error.message : "unknown error",
    );
    throw new Error("Unable to load movies right now.");
  }

  // Never throws (see getWatchProvidersForMovies) - a provider lookup
  // failure for one or all movies just means no badges are shown, it must
  // never take down the whole movies page.
  const rawProviders = await getWatchProvidersForMovies(movies.map((movie) => movie.id));
  const providersByMovieId = summarizeWatchProvidersByMovie(rawProviders);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{th.moviesPage.title}</h1>
      <p className="mt-1 text-sm opacity-70">{th.moviesPage.subtitle}</p>
      <MovieList movies={movies} providersByMovieId={providersByMovieId} />
    </main>
  );
}
