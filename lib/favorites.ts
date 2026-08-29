// Client-side only storage for favorited movie IDs. Isolated from the TMDB
// client, preferences, watched state, and recommendation scoring - only
// ever deals with TMDB movie IDs (numbers). Mirrors lib/watched.ts.

const FAVORITES_STORAGE_KEY = "movie-recommendation:favorites";

interface StoredFavorites {
  movieIds: number[];
}

/** Reads favorited movie IDs. Returns [] if none exist, or if stored data is invalid/corrupted. */
export function loadFavorites(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as Partial<StoredFavorites>).movieIds)
    ) {
      return [];
    }
    return (parsed as StoredFavorites).movieIds.filter(
      (id): id is number => typeof id === "number" && Number.isFinite(id),
    );
  } catch {
    return [];
  }
}

/** Saves the full favorited-ID list. Returns true on success. */
export function saveFavorites(movieIds: number[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    const data: StoredFavorites = { movieIds };
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Toggles a single movie's favorited status against the latest stored state
 * (not a caller-held copy, so this is safe to call independently from
 * multiple cards without racing). Returns the resulting full list.
 */
export function toggleFavorite(movieId: number): number[] {
  const current = loadFavorites();
  const next = current.includes(movieId)
    ? current.filter((id) => id !== movieId)
    : [...current, movieId];
  saveFavorites(next);
  return next;
}
