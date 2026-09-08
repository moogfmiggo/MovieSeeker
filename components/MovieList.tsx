"use client";

import { useEffect, useState } from "react";
import type { TMDBMovie } from "@/types/tmdb";
import type { WatchProviderSummary } from "@/lib/watchProviders";
import { MovieCard } from "@/components/MovieCard";
import {
  filterUnwatched,
  loadWatched,
  loadWatchedSeries,
  toggleWatched,
  toggleWatchedSeries,
} from "@/lib/watched";
import {
  loadFavorites,
  loadFavoriteSeries,
  toggleFavorite,
  toggleFavoriteSeries,
} from "@/lib/favorites";
import { buildMovieFeedApiHref, mergeMoviesById } from "@/lib/movieSearch";
import { buildTitleSearchFeedApiHref } from "@/lib/titleSearch";
import { th } from "@/lib/i18n";
import { sortMoviesByRating } from "@/lib/movieRating";
import type {
  SemanticCandidateInput,
  SemanticConstraintSlug,
  SemanticMediaType,
} from "@/lib/semantic/constraints";

interface MovieFeedResponse {
  results: TMDBMovie[];
  providers?: Record<number, WatchProviderSummary>;
  page: number;
  totalPages: number;
}

type SemanticFilterResponse =
  | { applied: false; reason: string }
  | {
      applied: true;
      source: "ai" | "cache";
      matchedIds: number[];
      rejectedIds: number[];
      unknownIds: number[];
    };

type SemanticFilterMode = "not-needed" | "checking" | "applied" | "fallback";

function isMovieFeedResponse(data: unknown): data is MovieFeedResponse {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<MovieFeedResponse>;
  return (
    Array.isArray(candidate.results) &&
    typeof candidate.page === "number" &&
    typeof candidate.totalPages === "number"
  );
}

function isSemanticFilterResponse(data: unknown): data is SemanticFilterResponse {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<SemanticFilterResponse>;
  if (candidate.applied === false) return typeof candidate.reason === "string";
  if (candidate.applied !== true) return false;
  return (
    (candidate.source === "ai" || candidate.source === "cache") &&
    Array.isArray(candidate.matchedIds) &&
    Array.isArray(candidate.rejectedIds) &&
    Array.isArray(candidate.unknownIds)
  );
}

function toSemanticCandidates(
  movies: readonly TMDBMovie[],
  mediaType: SemanticMediaType,
): SemanticCandidateInput[] {
  return movies.map((movie) => ({
    id: movie.id,
    mediaType,
    title: movie.title,
    originalTitle: movie.original_title || movie.title,
    overview: movie.overview,
    releaseYear: /^\d{4}/.test(movie.release_date) ? movie.release_date.slice(0, 4) : "",
  }));
}

async function requestSemanticFilter(
  movies: readonly TMDBMovie[],
  mediaType: SemanticMediaType,
  constraints: readonly SemanticConstraintSlug[],
  storyRequirement: string,
  signal?: AbortSignal,
): Promise<SemanticFilterResponse> {
  try {
    const response = await fetch("/api/search/semantic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mediaType,
        constraints,
        storyRequirement,
        candidates: toSemanticCandidates(movies, mediaType),
      }),
      signal,
    });
    if (!response.ok) return { applied: false, reason: "request_failed" };
    const data: unknown = await response.json();
    return isSemanticFilterResponse(data)
      ? data
      : { applied: false, reason: "invalid_response" };
  } catch {
    return { applied: false, reason: "request_failed" };
  }
}

export function MovieList({
  movies,
  providersByMovieId,
  selectedGenreIds = [],
  selectedTopicSlugs = [],
  selectedProviderIds = [],
  selectedSeriesGenreIds = [],
  selectedSeriesTopicSlugs = [],
  mediaType = "movie",
  searchQuery = "",
  originCountry = "",
  semanticConstraints = [],
  storyRequirement = "",
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
  selectedSeriesTopicSlugs?: readonly string[];
  mediaType?: "movie" | "tv";
  searchQuery?: string;
  originCountry?: string;
  semanticConstraints?: readonly SemanticConstraintSlug[];
  storyRequirement?: string;
  emptyMessage?: string;
  initialPage?: number;
  totalPages?: number;
}) {
  const [watchedIds, setWatchedIds] = useState<number[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [showWatchedToo, setShowWatchedToo] = useState(false);
  const [loadedMovies, setLoadedMovies] = useState(() => sortMoviesByRating(movies));
  const [loadedProviders, setLoadedProviders] = useState<Record<number, WatchProviderSummary>>(
    providersByMovieId ?? {},
  );
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [availablePages, setAvailablePages] = useState(totalPages);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const hasSemanticRequirement = semanticConstraints.length > 0 || !!storyRequirement;
  const [semanticMode, setSemanticMode] = useState<SemanticFilterMode>(() =>
    !hasSemanticRequirement
      ? "not-needed"
      : movies.length === 0
        ? "applied"
        : "checking",
  );
  const [semanticMatchedIds, setSemanticMatchedIds] = useState<number[]>([]);
  const [semanticExcludedCount, setSemanticExcludedCount] = useState(0);

  useEffect(() => {
    // Watched/favorite state is browser-local and intentionally restored
    // after hydration. Genre/topic filtering already happened on the server from
    // the URL's explicit search intent, so it must not be replaced here by
    // a soft client-side reorder of a Popular pool.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWatchedIds(mediaType === "tv" ? loadWatchedSeries() : loadWatched());
    setFavoriteIds(mediaType === "tv" ? loadFavoriteSeries() : loadFavorites());
  }, [mediaType]);

  useEffect(() => {
    if (!hasSemanticRequirement || movies.length === 0) return;
    const controller = new AbortController();

    void requestSemanticFilter(
      movies,
      mediaType,
      semanticConstraints,
      storyRequirement,
      controller.signal,
    ).then(
      (result) => {
        if (controller.signal.aborted) return;
        if (!result.applied) {
          setSemanticMode("fallback");
          return;
        }
        setSemanticMatchedIds(result.matchedIds);
        setSemanticExcludedCount(result.rejectedIds.length + result.unknownIds.length);
        setSemanticMode("applied");
      },
    );

    return () => controller.abort();
  }, [hasSemanticRequirement, mediaType, movies, semanticConstraints, storyRequirement]);

  function handleToggleWatched(movieId: number) {
    setWatchedIds(mediaType === "tv" ? toggleWatchedSeries(movieId) : toggleWatched(movieId));
  }

  function handleToggleFavorite(movieId: number) {
    setFavoriteIds(mediaType === "tv" ? toggleFavoriteSeries(movieId) : toggleFavorite(movieId));
  }

  async function handleShowMore() {
    if (isLoadingMore || semanticMode === "checking" || currentPage >= availablePages) return;

    setIsLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const response = await fetch(
        searchQuery
          ? buildTitleSearchFeedApiHref(currentPage + 1, searchQuery, mediaType)
          : buildMovieFeedApiHref(
              currentPage + 1,
              selectedGenreIds,
              selectedTopicSlugs,
              selectedProviderIds,
              selectedSeriesGenreIds,
              mediaType,
              selectedSeriesTopicSlugs,
              originCountry,
            ),
      );
      if (!response.ok) throw new Error(`movie feed failed with status ${response.status}`);

      const data: unknown = await response.json();
      if (!isMovieFeedResponse(data)) throw new Error("invalid movie feed response");

      if (hasSemanticRequirement && semanticMode === "applied") {
        const semanticResult = await requestSemanticFilter(
          data.results,
          mediaType,
          semanticConstraints,
          storyRequirement,
        );
        if (!semanticResult.applied) {
          // The no-queue rule applies to Show more too. If the RTX worker is
          // no longer available, switch the whole list back to Genre results
          // instead of mixing checked and unchecked cards.
          setSemanticMode("fallback");
        } else {
          setSemanticMatchedIds((current) => [
            ...new Set([...current, ...semanticResult.matchedIds]),
          ]);
          setSemanticExcludedCount(
            (current) =>
              current + semanticResult.rejectedIds.length + semanticResult.unknownIds.length,
          );
        }
      }

      setLoadedMovies((current) =>
        sortMoviesByRating(mergeMoviesById(current, data.results)),
      );
      setLoadedProviders((current) => ({ ...current, ...(data.providers ?? {}) }));
      setCurrentPage(data.page);
      setAvailablePages(data.totalPages);
    } catch {
      setLoadMoreFailed(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

  const semanticMatchSet = new Set(semanticMatchedIds);
  const semanticMovies = semanticMode === "checking"
    ? []
    : semanticMode === "applied"
      ? loadedMovies.filter((movie) => semanticMatchSet.has(movie.id))
      : loadedMovies;
  const visibleMovies = showWatchedToo
    ? semanticMovies
    : filterUnwatched(semanticMovies, watchedIds);
  const allWatched = visibleMovies.length === 0 && !showWatchedToo;
  const hasMore = currentPage < availablePages;

  return (
    <div className="mt-6">
      {semanticMode !== "checking" && semanticMovies.length > 0 && (
        <p className="mb-3 text-xs text-muted">
          {hasMore ? th.movieList.loadedRatingOrder : th.movieList.ratingOrder}
        </p>
      )}
      {mediaType === "movie" && (selectedGenreIds.length > 0 || selectedTopicSlugs.length > 0) && (
        <p className="mb-3 text-sm font-medium text-accent">
          {th.movieList.matchesAllSelectedGenres}
        </p>
      )}

      {semanticMode === "fallback" && (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {th.movieList.semanticFallback}
        </p>
      )}
      {semanticMode === "applied" && semanticMovies.length > 0 && (
        <p className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {th.movieList.semanticApplied(semanticMovies.length, semanticExcludedCount)}
        </p>
      )}

      {semanticMode === "checking" ? (
        <div
          className="rounded-lg border border-accent/40 bg-accent/10 px-5 py-8 text-center text-sm"
          role="status"
        >
          <span className="inline-block size-4 animate-spin rounded-full border-2 border-accent border-t-transparent align-[-3px]" />
          <span className="ml-2">{th.movieList.semanticChecking}</span>
        </div>
      ) : loadedMovies.length === 0 ? (
        <p className="text-sm opacity-70">{emptyMessage}</p>
      ) : semanticMode === "applied" && semanticMovies.length === 0 ? (
        <div className="rounded-lg border border-border p-6 text-center text-sm">
          <p>{th.movieList.semanticNoConfirmed}</p>
          {hasMore && <p className="mt-2 text-xs opacity-70">{th.movieList.semanticTryMore}</p>}
        </div>
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
                showActions
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
            disabled={isLoadingMore || semanticMode === "checking"}
            className="rounded-full border border-accent px-7 py-3 text-sm font-semibold text-accent transition hover:bg-accent hover:text-accent-foreground disabled:cursor-wait disabled:opacity-60"
          >
            {isLoadingMore && hasSemanticRequirement && semanticMode === "applied"
              ? th.movieList.semanticLoadingMore
              : isLoadingMore
                ? th.movieList.loadingMore
                : th.movieList.showMore}
          </button>
        </div>
      )}
    </div>
  );
}
