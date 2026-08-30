"use client";

import { useEffect, useState } from "react";
import type { TMDBMovie } from "@/types/tmdb";
import type { WatchProviderSummary } from "@/lib/watchProviders";
import { MovieCard } from "@/components/MovieCard";
import { loadWatched, toggleWatched } from "@/lib/watched";
import { loadFavorites, toggleFavorite } from "@/lib/favorites";
import { th } from "@/lib/i18n";

/**
 * Renders a responsive grid of MovieCards wired to watched state - the same
 * card + watched-toggle behavior as MovieList, without MovieList's
 * preference-based reordering. This isn't a recommendation surface, just
 * "here are this person/company's movies".
 */
export function MovieGrid({
  movies,
  emptyMessage = th.movieList.noMoviesFound,
  providersByMovieId,
  scoresByMovieId,
  reasonsByMovieId,
}: {
  movies: TMDBMovie[];
  emptyMessage?: string;
  providersByMovieId?: Record<number, WatchProviderSummary>;
  /** Phase 4 - personalization match 0-100 per movie id. Omit entirely for non-personalized grids. */
  scoresByMovieId?: Record<number, number>;
  /** Phase 4 - resolved Thai reason text per movie id, paired with scoresByMovieId. */
  reasonsByMovieId?: Record<number, string>;
}) {
  const [watchedIds, setWatchedIds] = useState<number[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWatchedIds(loadWatched());
    setFavoriteIds(loadFavorites());
  }, []);

  function handleToggleWatched(movieId: number) {
    setWatchedIds(toggleWatched(movieId));
  }

  function handleToggleFavorite(movieId: number) {
    setFavoriteIds(toggleFavorite(movieId));
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
            isFavorited={favoriteIds.includes(movie.id)}
            onToggleFavorite={() => handleToggleFavorite(movie.id)}
            providers={providersByMovieId?.[movie.id]}
            matchScore={scoresByMovieId?.[movie.id]}
            matchReason={reasonsByMovieId?.[movie.id]}
          />
        </li>
      ))}
    </ul>
  );
}
