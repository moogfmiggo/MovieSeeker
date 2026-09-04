"use client";

import { useEffect, useState } from "react";
import {
  loadFavorites,
  loadFavoriteSeries,
  toggleFavorite,
  toggleFavoriteSeries,
} from "@/lib/favorites";
import { th } from "@/lib/i18n";

/** Filled when favorited, outline otherwise - matches MovieCard's heart toggle. */
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 20.5s-7.5-4.6-10-9.1C.5 7.8 2.4 4.5 5.8 4c2.1-.3 4.1.8 6.2 3.2C14.1 4.8 16.1 3.7 18.2 4c3.4.5 5.3 3.8 3.8 7.4-2.5 4.5-10 9.1-10 9.1z" />
    </svg>
  );
}

/**
 * Self-contained favorite toggle for a single movie (the detail page hero).
 * Unlike MovieCard's isFavorited/onToggleFavorite props - which are driven
 * by a parent list that already needs favorited IDs for its own state -
 * this owns its own state, since there's no parent list here. Mirrors
 * WatchedButton exactly.
 */
export function FavoriteButton({
  movieId,
  movieTitle,
  mediaType = "movie",
}: {
  movieId: number;
  movieTitle: string;
  mediaType?: "movie" | "tv";
}) {
  const [favorited, setFavorited] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorited(
      (mediaType === "tv" ? loadFavoriteSeries() : loadFavorites()).includes(movieId),
    );
  }, [mediaType, movieId]);

  if (favorited === null) {
    return <div className="h-11 w-40 animate-pulse rounded-full bg-white/10" aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      onClick={() => setFavorited(
        (mediaType === "tv" ? toggleFavoriteSeries(movieId) : toggleFavorite(movieId)).includes(movieId),
      )}
      aria-pressed={favorited}
      aria-label={favorited ? th.favorite.removeLabel(movieTitle) : th.favorite.addLabel(movieTitle)}
      title={favorited ? th.favorite.removeLabel(movieTitle) : th.favorite.addLabel(movieTitle)}
      className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium shadow transition ${
        favorited ? "bg-accent text-accent-foreground" : "bg-black/60 text-white backdrop-blur-sm hover:bg-black/75"
      }`}
    >
      <HeartIcon filled={favorited} />
      {favorited ? th.favorite.remove : th.favorite.add}
    </button>
  );
}
