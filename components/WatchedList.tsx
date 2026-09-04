"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TMDBMovie } from "@/types/tmdb";
import type { WatchProviderSummary } from "@/lib/watchProviders";
import { MovieCard } from "@/components/MovieCard";
import {
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
import { th } from "@/lib/i18n";

type Status = "loading" | "ready" | "error";

export function WatchedList() {
  const [status, setStatus] = useState<Status>("loading");
  const [items, setItems] = useState<TMDBMovie[]>([]);
  const [providersByMovieId, setProvidersByMovieId] = useState<Record<number, WatchProviderSummary>>({});
  const [providersBySeriesId, setProvidersBySeriesId] = useState<Record<number, WatchProviderSummary>>({});
  // Favorites are local state, independent of the async movie fetch above -
  // loaded in their own effect rather than folded into `load()`.
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoriteSeriesIds, setFavoriteSeriesIds] = useState<number[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavoriteIds(loadFavorites());
    setFavoriteSeriesIds(loadFavoriteSeries());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const watchedIds = loadWatched();
      const watchedSeriesIds = loadWatchedSeries();
      if (watchedIds.length === 0 && watchedSeriesIds.length === 0) {
        if (!cancelled) {
          setItems([]);
          setStatus("ready");
        }
        return;
      }
      try {
        const [movieResponse, seriesResponse] = await Promise.all([
          watchedIds.length > 0 ? fetch(`/api/tmdb/movies?ids=${watchedIds.join(",")}`) : null,
          watchedSeriesIds.length > 0
            ? fetch(`/api/tmdb/series?ids=${watchedSeriesIds.join(",")}`)
            : null,
        ]);
        if (movieResponse && !movieResponse.ok) throw new Error(`movie request failed with status ${movieResponse.status}`);
        if (seriesResponse && !seriesResponse.ok) throw new Error(`series request failed with status ${seriesResponse.status}`);
        const movieData: unknown = movieResponse ? await movieResponse.json() : null;
        const seriesData: unknown = seriesResponse ? await seriesResponse.json() : null;
        if (!cancelled) {
          setItems([...readResults(movieData), ...readResults(seriesData)]);
          setProvidersByMovieId(readProviders(movieData));
          setProvidersBySeriesId(readProviders(seriesData));
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleUnwatch(item: TMDBMovie) {
    if (item.media_type === "tv") toggleWatchedSeries(item.id);
    else toggleWatched(item.id);
    setItems((current) => current.filter(
      (candidate) => candidate.id !== item.id || candidate.media_type !== item.media_type,
    ));
  }

  function handleToggleFavorite(item: TMDBMovie) {
    if (item.media_type === "tv") setFavoriteSeriesIds(toggleFavoriteSeries(item.id));
    else setFavoriteIds(toggleFavorite(item.id));
  }

  if (status === "loading") {
    return (
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[2/3] rounded-lg bg-surface" />
            <div className="mt-2 h-4 w-3/4 rounded bg-surface" />
            <div className="mt-1 h-3 w-1/2 rounded bg-surface" />
          </div>
        ))}
      </div>
    );
  }

  if (status === "error") {
    return <p className="mt-8 text-sm text-red-400">{th.watchedPage.loadError}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-border p-6 text-center text-sm">
        <p>{th.watchedPage.empty}</p>
        <Link
          href="/discover"
          className="mt-3 inline-block text-accent underline underline-offset-2"
        >
          {th.watchedPage.browseMovies}
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-6 grid list-none grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
      {items.map((movie) => {
        const isSeries = movie.media_type === "tv";
        return <li key={`${isSeries ? "tv" : "movie"}:${movie.id}`}>
          <MovieCard
            movie={movie}
            isWatched
            onToggleWatched={() => handleUnwatch(movie)}
            isFavorited={(isSeries ? favoriteSeriesIds : favoriteIds).includes(movie.id)}
            onToggleFavorite={() => handleToggleFavorite(movie)}
            providers={(isSeries ? providersBySeriesId : providersByMovieId)[movie.id]}
          />
        </li>;
      })}
    </ul>
  );
}

function readResults(data: unknown): TMDBMovie[] {
  return data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)
    ? (data as { results: TMDBMovie[] }).results
    : [];
}

function readProviders(data: unknown): Record<number, WatchProviderSummary> {
  const providers = data && typeof data === "object" ? (data as { providers?: unknown }).providers : null;
  return providers && typeof providers === "object"
    ? providers as Record<number, WatchProviderSummary>
    : {};
}
