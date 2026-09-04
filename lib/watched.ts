// Client-side only storage for watched movie IDs. Isolated from the TMDB
// client, preferences, and recommendation scoring - only ever deals with
// TMDB movie IDs (numbers).

const WATCHED_STORAGE_KEY = "movie-recommendation:watched";

interface StoredWatched {
  movieIds: number[];
  seriesIds?: number[];
}

function normalizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0,
  ))];
}

function loadStoredWatched(): StoredWatched {
  if (typeof window === "undefined") return { movieIds: [], seriesIds: [] };
  try {
    const raw = window.localStorage.getItem(WATCHED_STORAGE_KEY);
    if (!raw) return { movieIds: [], seriesIds: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { movieIds: [], seriesIds: [] };
    const stored = parsed as Partial<StoredWatched>;
    return {
      movieIds: normalizeIds(stored.movieIds),
      seriesIds: normalizeIds(stored.seriesIds),
    };
  } catch {
    return { movieIds: [], seriesIds: [] };
  }
}

function saveStoredWatched(data: StoredWatched): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Reads watched movie IDs. Returns [] if none exist, or if stored data is invalid/corrupted. */
export function loadWatched(): number[] {
  return loadStoredWatched().movieIds;
}

/** Series use their own ID namespace because TMDB movie and TV IDs can collide. */
export function loadWatchedSeries(): number[] {
  return loadStoredWatched().seriesIds ?? [];
}

/** Saves the full watched-ID list. Returns true on success. */
export function saveWatched(movieIds: number[]): boolean {
  const current = loadStoredWatched();
  return saveStoredWatched({ ...current, movieIds: normalizeIds(movieIds) });
}

export function saveWatchedSeries(seriesIds: number[]): boolean {
  const current = loadStoredWatched();
  return saveStoredWatched({ ...current, seriesIds: normalizeIds(seriesIds) });
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

export function toggleWatchedSeries(seriesId: number): number[] {
  const current = loadWatchedSeries();
  const next = current.includes(seriesId)
    ? current.filter((id) => id !== seriesId)
    : [...current, seriesId];
  saveWatchedSeries(next);
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
