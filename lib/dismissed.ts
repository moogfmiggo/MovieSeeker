// Client-side only storage for dismissed movie IDs (Phase 4, Part 5 - "ไม่สนใจ").
// Isolated from the TMDB client, preferences, watched state, and
// recommendation scoring - only ever deals with TMDB movie IDs (numbers).
// Mirrors lib/watched.ts exactly; kept as a separate module (not a shared
// "list of IDs" helper) so watched/dismissed remain independently toggled
// and independently corruption-safe, matching the existing favorites/watched
// pattern rather than introducing a new shared abstraction.

const DISMISSED_STORAGE_KEY = "movie-recommendation:dismissed";

interface StoredDismissed {
  movieIds: number[];
}

/** Reads dismissed movie IDs. Returns [] if none exist, or if stored data is invalid/corrupted. */
export function loadDismissed(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as Partial<StoredDismissed>).movieIds)
    ) {
      return [];
    }
    return (parsed as StoredDismissed).movieIds.filter(
      (id): id is number => typeof id === "number" && Number.isFinite(id),
    );
  } catch {
    return [];
  }
}

/** Saves the full dismissed-ID list. Returns true on success. */
export function saveDismissed(movieIds: number[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    const data: StoredDismissed = { movieIds };
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Toggles a single movie's dismissed status against the latest stored state
 * (not a caller-held copy, so this is safe to call independently from
 * multiple cards without racing). Returns the resulting full list.
 */
export function toggleDismissed(movieId: number): number[] {
  const current = loadDismissed();
  const next = current.includes(movieId)
    ? current.filter((id) => id !== movieId)
    : [...current, movieId];
  saveDismissed(next);
  return next;
}

/**
 * Removes dismissed movies from a list, preserving the relative order of the
 * rest. Pure - does not mutate `movies`. Mirrors filterUnwatched.
 */
export function filterUndismissed<T extends { id: number }>(
  movies: readonly T[] | null | undefined,
  dismissedIds: readonly number[] | null | undefined,
): T[] {
  if (!Array.isArray(movies)) return [];
  const dismissedSet = new Set(Array.isArray(dismissedIds) ? dismissedIds : []);
  return movies.filter((movie) => !dismissedSet.has(movie.id));
}
