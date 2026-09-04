"use client";

import { useEffect, useState } from "react";
import type { TMDBMovie } from "@/types/tmdb";
import type { WatchProviderSummary } from "@/lib/watchProviders";
import { MovieCard } from "@/components/MovieCard";
import { loadWatched, toggleWatched, filterUnwatched } from "@/lib/watched";
import { loadFavorites, toggleFavorite } from "@/lib/favorites";
import { buildMovieFeedApiHref, mergeMoviesById } from "@/lib/movieSearch";
import { th } from "@/lib/i18n";

interface MovieFeedResponse {
  results: TMDBMovie[];
  providers?: Record<number, WatchProviderSummary>;
  page: number;
  totalPages: number;
}

function isMovieFeedResponse(data: unknown): data is MovieFeedResponse {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<MovieFeedResponse>;
  return (
    Array.isArray(candidate.results) &&
    typeof candidate.page === "number" &&
    typeof candidate.totalPages === "number"
  );
}

export function MovieList({
  movies,
  providersByMovieId,
  selectedGenreIds = [],
  selectedTopicSlugs = [],
  selectedProviderIds = [],
  selectedSeriesGenreIds = [],
  mediaType = "movie",
  emptyMessage = th.movieList.noMoviesFound,
  initialPage = 1,
  totalPages = 1,
}: {
  movies: TMDBMovie[];
  providersByMovieId?: Record<number, WatchProviderSummary>;
  selectedGenreIds?: readonly number[];
  selectedTopicSlugs?: readonly string[];
  selectedProviderIds?: readonly number[];
  selectedSeriesGenreIds?: readonly number[];
  mediaType?: "movie" | "tv";
  emptyMessage?: string;
  initialPage?: number;
  totalPages?: number;
}) {
  const [watchedIds, setWatchedIds] = useState<number[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [showWatchedToo, setShowWatchedToo] = useState(false);
  const [loadedMovies, setLoadedMovies] = useState(movies);
  const [loadedProviders, setLoadedProviders] = useState<Record<number, WatchProviderSummary>>(
    providersByMovieId ?? {},
  );
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [availablePages, setAvailablePages] = useState(totalPages);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  useEffect(() => {
    // Watched/favorite state is browser-local and intentionally restored
    // after hydration. Genre/topic filtering already happened on the server from
    // the URL's explicit search intent, so it must not be replaced here by
    // a soft client-side reorder of a Popular pool.
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

  async function handleShowMore() {
    if (isLoadingMore || currentPage >= availablePages) return;

    setIsLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const response = await fetch(
        buildMovieFeedApiHref(
          currentPage + 1,
          selectedGenreIds,
          selectedTopicSlugs,
          selectedProviderIds,
          selectedSeriesGenreIds,
          mediaType,
        ),
      );
      if (!response.ok) throw new Error(`movie feed failed with status ${response.status}`);

      const data: unknown = await response.json();
      if (!isMovieFeedResponse(data)) throw new Error("invalid movie feed response");

      setLoadedMovies((current) => mergeMoviesById(current, data.results));
      setLoadedProviders((current) => ({ ...current, ...(data.providers ?? {}) }));
      setCurrentPage(data.page);
      setAvailablePages(data.totalPages);
    } catch {
      setLoadMoreFailed(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

  const visibleMovies = mediaType === "tv"
    ? loadedMovies
    : showWatchedToo
    ? loadedMovies
    : filterUnwatched(loadedMovies, watchedIds);
  const allWatched = mediaType === "movie" && visibleMovies.length === 0 && !showWatchedToo;
  const hasMore = currentPage < availablePages;

  return (
    <div className="mt-6">
      {mediaType === "movie" && (selectedGenreIds.length > 0 || selectedTopicSlugs.length > 0) && (
        <p className="mb-3 text-sm font-medium text-accent">
          {th.movieList.matchesAllSelectedGenres}
        </p>
      )}

      {loadedMovies.length === 0 ? (
        <p className="text-sm opacity-70">{emptyMessage}</p>
      ) : allWatched ? (
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
                providers={loadedProviders[movie.id]}
                showActions={mediaType === "movie"}
              />
            </li>
          ))}
        </ul>
      )}

      {loadMoreFailed && (
        <p className="mt-5 text-center text-sm text-red-400" role="alert">
          {th.movieList.loadMoreError}
        </p>
      )}

      {hasMore && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={handleShowMore}
            disabled={isLoadingMore}
            className="rounded-full border border-accent px-7 py-3 text-sm font-semibold text-accent transition hover:bg-accent hover:text-accent-foreground disabled:cursor-wait disabled:opacity-60"
          >
            {isLoadingMore ? th.movieList.loadingMore : th.movieList.showMore}
          </button>
        </div>
      )}
    </div>
  );
}
