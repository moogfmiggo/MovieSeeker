"use client";

import { useEffect, useState } from "react";
import {
  loadWatched,
  loadWatchedSeries,
  toggleWatched,
  toggleWatchedSeries,
} from "@/lib/watched";
import { th } from "@/lib/i18n";

/**
 * Self-contained watched toggle for a single movie (the detail page hero).
 * Unlike MovieCard's isWatched/onToggleWatched props - which are driven by a
 * parent list that already needs watched IDs for filtering - this owns its
 * own state, since there's no parent list here.
 */
export function WatchedButton({
  movieId,
  mediaType = "movie",
}: {
  movieId: number;
  mediaType?: "movie" | "tv";
}) {
  const [watched, setWatched] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWatched((mediaType === "tv" ? loadWatchedSeries() : loadWatched()).includes(movieId));
  }, [mediaType, movieId]);

  if (watched === null) {
    return <div className="h-11 w-40 animate-pulse rounded-full bg-white/10" aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      onClick={() => setWatched(
        (mediaType === "tv" ? toggleWatchedSeries(movieId) : toggleWatched(movieId)).includes(movieId),
      )}
      aria-pressed={watched}
      className={`rounded-full px-6 py-3 text-sm font-medium shadow transition ${
        watched ? "bg-accent text-accent-foreground" : "bg-black/60 text-white backdrop-blur-sm hover:bg-black/75"
      }`}
    >
      {watched ? th.watched.watched : th.watched.markWatched}
    </button>
  );
}
