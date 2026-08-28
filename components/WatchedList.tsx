"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TMDBMovie } from "@/types/tmdb";
import type { WatchProviderSummary } from "@/lib/watchProviders";
import { MovieCard } from "@/components/MovieCard";
import { loadWatched, toggleWatched } from "@/lib/watched";
import { th } from "@/lib/i18n";

type Status = "loading" | "ready" | "error";

export function WatchedList() {
  const [status, setStatus] = useState<Status>("loading");
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [providersByMovieId, setProvidersByMovieId] = useState<Record<number, WatchProviderSummary>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const watchedIds = loadWatched();
      if (watchedIds.length === 0) {
        if (!cancelled) {
          setMovies([]);
          setStatus("ready");
        }
        return;
      }
      try {
        const res = await fetch(`/api/tmdb/movies?ids=${watchedIds.join(",")}`);
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

  function handleUnwatch(movieId: number) {
    toggleWatched(movieId);
    setMovies((current) => current.filter((movie) => movie.id !== movieId));
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

  if (movies.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-border p-6 text-center text-sm">
        <p>{th.watchedPage.empty}</p>
        <Link
          href="/movies"
          className="mt-3 inline-block text-accent underline underline-offset-2"
        >
          {th.watchedPage.browseMovies}
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
            isWatched
            onToggleWatched={() => handleUnwatch(movie.id)}
            providers={providersByMovieId[movie.id]}
          />
        </li>
      ))}
    </ul>
  );
}
