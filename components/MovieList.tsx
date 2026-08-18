"use client";

import { useEffect, useState } from "react";
import type { TMDBMovie } from "@/types/tmdb";
import { MovieCard } from "@/components/MovieCard";
import { loadPreferences } from "@/lib/preferences";
import { recommendMovies } from "@/lib/recommendations";

export function MovieList({ movies }: { movies: TMDBMovie[] }) {
  // Server-rendered/initial-hydration state matches what the server sent
  // (original TMDB order, not personalized) - preferences live in
  // localStorage, which only exists client-side, so personalization is
  // applied after mount.
  const [orderedMovies, setOrderedMovies] = useState<TMDBMovie[]>(movies);
  const [isPersonalized, setIsPersonalized] = useState(false);

  // localStorage only exists in the browser, so personalization is applied
  // after mount rather than during the initial (server-rendered) render.
  // Documented false positive for this rule on exactly this shape of code
  // (same as components/PreferencesForm.tsx).
  useEffect(() => {
    const selectedGenreIds = loadPreferences();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderedMovies(recommendMovies(movies, selectedGenreIds));
    setIsPersonalized(selectedGenreIds.length > 0);
  }, [movies]);

  if (orderedMovies.length === 0) {
    return <p className="mt-8 text-sm opacity-70">No movies found.</p>;
  }

  return (
    <div className="mt-6">
      {isPersonalized && (
        <p className="mb-3 text-sm font-medium text-neutral-700">Recommended for you</p>
      )}
      <ul className="grid list-none grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
        {orderedMovies.map((movie) => (
          <li key={movie.id}>
            <MovieCard movie={movie} />
          </li>
        ))}
      </ul>
    </div>
  );
}
