"use client";

import { useEffect, useState } from "react";
import { loadWatched, toggleWatched } from "@/lib/watched";
import { th } from "@/lib/i18n";

/**
 * Self-contained watched toggle for a single movie (the detail page hero).
 * Unlike MovieCard's isWatched/onToggleWatched props - which are driven by a
 * parent list that already needs watched IDs for filtering - this owns its
 * own state, since there's no parent list here.
 */
export function WatchedButton({ movieId }: { movieId: number }) {
  const [watched, setWatched] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWatched(loadWatched().includes(movieId));
  }, [movieId]);

  if (watched === null) {
    return <div className="h-11 w-40 animate-pulse rounded-full bg-white/10" aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      onClick={() => setWatched(toggleWatched(movieId).includes(movieId))}
      aria-pressed={watched}
      className={`rounded-full px-6 py-3 text-sm font-medium shadow transition ${
        watched ? "bg-neutral-900 text-white" : "bg-white/90 text-neutral-900 hover:bg-white"
      }`}
    >
      {watched ? th.watched.watched : th.watched.markWatched}
    </button>
  );
}
