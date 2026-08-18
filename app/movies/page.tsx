import { getPopularMovies } from "@/lib/tmdb";
import { MovieCard } from "@/components/MovieCard";

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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Popular Movies</h1>
      <p className="mt-1 text-sm opacity-70">Sourced live from TMDB.</p>

      {movies.length === 0 ? (
        <p className="mt-8 text-sm opacity-70">No movies found.</p>
      ) : (
        <ul className="mt-6 grid list-none grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
          {movies.map((movie) => (
            <li key={movie.id}>
              <MovieCard movie={movie} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
