// Client-side only storage for watched movie IDs. Isolated from the TMDB
// client, preferences, and recommendation scoring - only ever deals with
// TMDB movie IDs (numbers).

const WATCHED_STORAGE_KEY = "movie-recommendation:watched";

interface StoredWatched {
  movieIds: number[];
}

/** Reads watched movie IDs. Returns [] if none exist, or if stored data is invalid/corrupted. */
export function loadWatched(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WATCHED_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as Partial<StoredWatched>).movieIds)
    ) {
      return [];
    }
    return (parsed as StoredWatched).movieIds.filter(
      (id): id is number => typeof id === "number" && Number.isFinite(id),
    );
  } catch {
    return [];
  }
}

/** Saves the full watched-ID list. Returns true on success. */
export function saveWatched(movieIds: number[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    const data: StoredWatched = { movieIds };
    window.localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Toggles a single movie's watched status against the latest stored state
 * (not a caller-held copy, so this is safe to call independently from
 * multiple cards without racing). Returns the resulting full list.
 */
export function toggleWatched(movieId: number): number[] {
  const current = loadWatched();
  const next = current.includes(movieId)
    ? current.filter((id) => id !== movieId)
    : [...current, movieId];
  saveWatched(next);
  return next;
}

/**
 * Removes watched movies from a list, preserving the relative order of the
 * rest. Pure - does not mutate `movies`. Never used to affect scoring.
 */
export function filterUnwatched<T extends { id: number }>(
  movies: readonly T[] | null | undefined,
  watchedIds: readonly number[] | null | undefined,
): T[] {
  if (!Array.isArray(movies)) return [];
  const watchedSet = new Set(Array.isArray(watchedIds) ? watchedIds : []);
  return movies.filter((movie) => !watchedSet.has(movie.id));
}
