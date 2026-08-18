import type { TMDBMovie } from "@/types/tmdb";

/**
 * Normalizes a list of raw genre-id-like values into a Set<number>,
 * dropping anything that isn't a finite number (NaN, null, undefined,
 * non-numeric strings, etc). Works whether values arrived as numbers or
 * as strings (e.g. round-tripped through JSON/localStorage).
 */
function toGenreIdSet(rawIds: unknown): Set<number> {
  const ids = new Set<number>();
  if (!Array.isArray(rawIds)) return ids;
  for (const raw of rawIds) {
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (Number.isFinite(n)) ids.add(n);
  }
  return ids;
}

/** A movie's genre_ids may be missing/null/undefined/malformed - treat as empty. */
function movieGenreIdSet(movie: Pick<TMDBMovie, "genre_ids">): Set<number> {
  return toGenreIdSet((movie as { genre_ids?: unknown }).genre_ids);
}

/**
 * One movie's preference score against the user's selected genres:
 * (matching genres / selected genres) x 100. Always finite, 0-100 -
 * never NaN/Infinity, regardless of missing/malformed input on either side.
 */
export function calculatePreferenceScore(
  movie: Pick<TMDBMovie, "genre_ids">,
  selectedGenreIds: unknown,
): number {
  const preferredGenreIds = toGenreIdSet(selectedGenreIds);
  if (preferredGenreIds.size === 0) return 0;

  const genres = movieGenreIdSet(movie);
  let matches = 0;
  for (const id of genres) {
    if (preferredGenreIds.has(id)) matches++;
  }

  const rawScore = (matches / preferredGenreIds.size) * 100;
  return Number.isFinite(rawScore) ? Math.min(100, Math.max(0, rawScore)) : 0;
}

/**
 * Ranks movies by how well they match the user's selected genre
 * preferences. Pure: never mutates `movies`, always returns a new array.
 *
 * No valid selected genres -> deterministic fallback: original TMDB order
 * returned unchanged, no scoring/sorting applied.
 *
 * Otherwise, sorted by: 1) preferenceScore desc, 2) TMDB popularity desc,
 * 3) movie id asc - so ordering is fully deterministic even on ties.
 */
export function recommendMovies<T extends TMDBMovie>(
  movies: readonly T[] | null | undefined,
  selectedGenreIds: unknown,
): T[] {
  if (!Array.isArray(movies) || movies.length === 0) return [];

  const preferredGenreIds = toGenreIdSet(selectedGenreIds);
  if (preferredGenreIds.size === 0) {
    return [...movies];
  }

  return movies
    .map((movie) => ({
      movie,
      preferenceScore: calculatePreferenceScore(movie, selectedGenreIds),
    }))
    .sort((a, b) => {
      if (b.preferenceScore !== a.preferenceScore) {
        return b.preferenceScore - a.preferenceScore;
      }
      const popularityA = Number.isFinite(a.movie.popularity) ? a.movie.popularity : 0;
      const popularityB = Number.isFinite(b.movie.popularity) ? b.movie.popularity : 0;
      if (popularityB !== popularityA) {
        return popularityB - popularityA;
      }
      return a.movie.id - b.movie.id;
    })
    .map((entry) => entry.movie);
}
