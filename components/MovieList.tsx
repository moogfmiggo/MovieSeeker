"use client";

import { useEffect, useState } from "react";
import type { TMDBMovie } from "@/types/tmdb";
import { MovieCard } from "@/components/MovieCard";
import { loadPreferences } from "@/lib/preferences";
import { recommendMovies } from "@/lib/recommendations";
import { loadWatched, toggleWatched, filterUnwatched } from "@/lib/watched";

export function MovieList({ movies }: { movies: TMDBMovie[] }) {
  // Server-rendered/initial-hydration state matches what the server sent
  // (original TMDB order, nothing filtered) - preferences and watched state
  // live in localStorage, which only exists client-side, so both are
  // applied after mount.
  const [orderedMovies, setOrderedMovies] = useState<TMDBMovie[]>(movies);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [watchedIds, setWatchedIds] = useState<number[]>([]);
  const [showWatchedToo, setShowWatchedToo] = useState(false);

  useEffect(() => {
    const selectedGenreIds = loadPreferences();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderedMovies(recommendMovies(movies, selectedGenreIds));
    setIsPersonalized(selectedGenreIds.length > 0);
    setWatchedIds(loadWatched());
  }, [movies]);

  function handleToggleWatched(movieId: number) {
    setWatchedIds(toggleWatched(movieId));
  }

  if (orderedMovies.length === 0) {
    return <p className="mt-8 text-sm opacity-70">No movies found.</p>;
  }

  const visibleMovies = showWatchedToo ? orderedMovies : filterUnwatched(orderedMovies, watchedIds);
  const allWatched = visibleMovies.length === 0 && !showWatchedToo;

  return (
    <div className="mt-6">
      {isPersonalized && (
        <p className="mb-3 text-sm font-medium text-neutral-700">Recommended for you</p>
      )}

      {allWatched ? (
        <div className="rounded-lg border border-black/10 p-6 text-center text-sm">
          <p>You&apos;ve watched everything in this list.</p>
          <button
            type="button"
            onClick={() => setShowWatchedToo(true)}
            className="mt-3 text-neutral-900 underline underline-offset-2"
          >
            Show watched movies
          </button>
        </div>
      ) : (
        <ul className="grid list-none grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
          {visibleMovies.map((movie) => (
            <li key={movie.id}>
              <MovieCard
                movie={movie}
                isWatched={watchedIds.includes(movie.id)}
                onToggleWatched={() => handleToggleWatched(movie.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
