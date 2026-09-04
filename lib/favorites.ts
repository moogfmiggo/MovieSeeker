// Client-side only storage for favorited movie IDs. Isolated from the TMDB
// client, preferences, watched state, and recommendation scoring - only
// ever deals with TMDB movie IDs (numbers). Mirrors lib/watched.ts.

const FAVORITES_STORAGE_KEY = "movie-recommendation:favorites";

interface StoredFavorites {
  movieIds: number[];
  seriesIds?: number[];
}

function loadStoredFavorites(): StoredFavorites {
  if (typeof window === "undefined") return { movieIds: [], seriesIds: [] };
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return { movieIds: [], seriesIds: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { movieIds: [], seriesIds: [] };
    const stored = parsed as Partial<StoredFavorites>;
    return {
      movieIds: normalizeIds(stored.movieIds),
      seriesIds: normalizeIds(stored.seriesIds),
    };
  } catch {
    return { movieIds: [], seriesIds: [] };
  }
}

function normalizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0,
  ))];
}

function saveStoredFavorites(data: StoredFavorites): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Reads favorited movie IDs. Returns [] if none exist, or if stored data is invalid/corrupted. */
export function loadFavorites(): number[] {
  return loadStoredFavorites().movieIds;
}

/** Series use their own ID namespace because TMDB movie and TV IDs can collide. */
export function loadFavoriteSeries(): number[] {
  return loadStoredFavorites().seriesIds ?? [];
}

/** Saves the full favorited-ID list. Returns true on success. */
export function saveFavorites(movieIds: number[]): boolean {
  const current = loadStoredFavorites();
  return saveStoredFavorites({ ...current, movieIds: normalizeIds(movieIds) });
}

export function saveFavoriteSeries(seriesIds: number[]): boolean {
  const current = loadStoredFavorites();
  return saveStoredFavorites({ ...current, seriesIds: normalizeIds(seriesIds) });
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

export function toggleFavoriteSeries(seriesId: number): number[] {
  const current = loadFavoriteSeries();
  const next = current.includes(seriesId)
    ? current.filter((id) => id !== seriesId)
    : [...current, seriesId];
  saveFavoriteSeries(next);
  return next;
}
