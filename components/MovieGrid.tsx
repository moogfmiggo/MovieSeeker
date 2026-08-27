"use client";

import { useEffect, useState } from "react";
import type { TMDBMovie } from "@/types/tmdb";
import { MovieCard } from "@/components/MovieCard";
import { loadWatched, toggleWatched } from "@/lib/watched";

/**
 * Renders a responsive grid of MovieCards wired to watched state - the same
 * card + watched-toggle behavior as MovieList, without MovieList's
 * preference-based reordering. This isn't a recommendation surface, just
 * "here are this person/company's movies".
 */
export function MovieGrid({
  movies,
  emptyMessage = "No movies found.",
}: {
  movies: TMDBMovie[];
  emptyMessage?: string;
}) {
  const [watchedIds, setWatchedIds] = useState<number[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWatchedIds(loadWatched());
  }, []);

  function handleToggleWatched(movieId: number) {
    setWatchedIds(toggleWatched(movieId));
  }

  if (movies.length === 0) {
    return <p className="mt-4 text-sm opacity-70">{emptyMessage}</p>;
  }

  return (
    <ul className="mt-4 grid list-none grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
      {movies.map((movie) => (
        <li key={movie.id}>
          <MovieCard
            movie={movie}
            isWatched={watchedIds.includes(movie.id)}
            onToggleWatched={() => handleToggleWatched(movie.id)}
          />
        </li>
      ))}
    </ul>
  );
}
