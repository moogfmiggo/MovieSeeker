"use client";

import { useEffect, useState } from "react";
import type { TMDBMovie } from "@/types/tmdb";
import type { WatchProviderSummary } from "@/lib/watchProviders";
import { MovieCard } from "@/components/MovieCard";
import { loadPreferences } from "@/lib/preferences";
import { recommendMovies } from "@/lib/recommendations";
import { loadWatched, toggleWatched, filterUnwatched } from "@/lib/watched";
import { loadFavorites, toggleFavorite } from "@/lib/favorites";
import { th } from "@/lib/i18n";

export function MovieList({
  movies,
  providersByMovieId,
}: {
  movies: TMDBMovie[];
  providersByMovieId?: Record<number, WatchProviderSummary>;
}) {
  // Server-rendered/initial-hydration state matches what the server sent
  // (original TMDB order, nothing filtered) - preferences and watched state
  // live in localStorage, which only exists client-side, so both are
  // applied after mount.
  const [orderedMovies, setOrderedMovies] = useState<TMDBMovie[]>(movies);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [watchedIds, setWatchedIds] = useState<number[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [showWatchedToo, setShowWatchedToo] = useState(false);

  useEffect(() => {
    const selectedGenreIds = loadPreferences();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderedMovies(recommendMovies(movies, selectedGenreIds));
    setIsPersonalized(selectedGenreIds.length > 0);
    setWatchedIds(loadWatched());
    setFavoriteIds(loadFavorites());
  }, [movies]);

  function handleToggleWatched(movieId: number) {
    setWatchedIds(toggleWatched(movieId));
  }

  function handleToggleFavorite(movieId: number) {
    setFavoriteIds(toggleFavorite(movieId));
  }

  if (orderedMovies.length === 0) {
    return <p className="mt-8 text-sm opacity-70">{th.movieList.noMoviesFound}</p>;
  }

  const visibleMovies = showWatchedToo ? orderedMovies : filterUnwatched(orderedMovies, watchedIds);
  const allWatched = visibleMovies.length === 0 && !showWatchedToo;

  return (
    <div className="mt-6">
      {isPersonalized && (
        <p className="mb-3 text-sm font-medium text-accent">{th.movieList.recommendedForYou}</p>
      )}

      {allWatched ? (
        <div className="rounded-lg border border-border p-6 text-center text-sm">
          <p>{th.movieList.allWatched}</p>
          <button
            type="button"
            onClick={() => setShowWatchedToo(true)}
            className="mt-3 text-accent underline underline-offset-2"
          >
            {th.movieList.showWatchedToo}
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
                isFavorited={favoriteIds.includes(movie.id)}
                onToggleFavorite={() => handleToggleFavorite(movie.id)}
                providers={providersByMovieId?.[movie.id]}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
