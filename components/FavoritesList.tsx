"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TMDBMovie } from "@/types/tmdb";
import type { WatchProviderSummary } from "@/lib/watchProviders";
import { MovieCard } from "@/components/MovieCard";
import { loadFavorites, toggleFavorite } from "@/lib/favorites";
import { loadWatched, toggleWatched } from "@/lib/watched";
import { th } from "@/lib/i18n";

type Status = "loading" | "ready" | "error";

export function FavoritesList() {
  const [status, setStatus] = useState<Status>("loading");
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [providersByMovieId, setProvidersByMovieId] = useState<Record<number, WatchProviderSummary>>({});
  // Watched is a secondary signal on this page (every card here is already
  // favorited) - loaded independently so the card can still show accurate
  // watched state instead of assuming "not watched".
  const [watchedIds, setWatchedIds] = useState<number[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWatchedIds(loadWatched());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const favoriteIds = loadFavorites();
      if (favoriteIds.length === 0) {
        if (!cancelled) {
          setMovies([]);
          setStatus("ready");
        }
        return;
      }
      try {
        const res = await fetch(`/api/tmdb/movies?ids=${favoriteIds.join(",")}`);
        if (!res.ok) throw new Error(`request failed with status ${res.status}`);
        const data: unknown = await res.json();
        const results =
          data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)
            ? ((data as { results: TMDBMovie[] }).results)
            : [];
        const rawProviders = data && typeof data === "object" ? (data as { providers?: unknown }).providers : null;
        const providers =
          rawProviders && typeof rawProviders === "object"
            ? (rawProviders as Record<number, WatchProviderSummary>)
            : {};
        if (!cancelled) {
          setMovies(results);
          setProvidersByMovieId(providers);
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

  function handleUnfavorite(movieId: number) {
    toggleFavorite(movieId);
    setMovies((current) => current.filter((movie) => movie.id !== movieId));
  }

  function handleToggleWatched(movieId: number) {
    setWatchedIds(toggleWatched(movieId));
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
    return <p className="mt-8 text-sm text-red-400">{th.favoritesPage.loadError}</p>;
  }

  if (movies.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-border p-6 text-center text-sm">
        <p>{th.favoritesPage.empty}</p>
        <Link href="/movies" className="mt-3 inline-block text-accent underline underline-offset-2">
          {th.favoritesPage.browseMovies}
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-6 grid list-none grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
      {movies.map((movie) => (
        <li key={movie.id}>
          <MovieCard
            movie={movie}
            isWatched={watchedIds.includes(movie.id)}
            onToggleWatched={() => handleToggleWatched(movie.id)}
            isFavorited
            onToggleFavorite={() => handleUnfavorite(movie.id)}
            providers={providersByMovieId[movie.id]}
          />
        </li>
      ))}
    </ul>
  );
}
