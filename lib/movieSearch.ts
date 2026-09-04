import type { TMDBMovie } from "../types/tmdb";
import { normalizeTopicSlugs } from "./movieTopics";
import { normalizeStreamingProviderIds } from "./streamingProviders";

/** TMDB supports at most a small, useful set of simultaneous genre filters. */
const MAX_SELECTED_GENRES = 10;

export type GenreMatchMode = "any" | "all";

/**
 * Normalizes genre IDs arriving from URL search params, React state, or
 * localStorage-shaped data. Invalid values are dropped and duplicates keep
 * their first occurrence so generated URLs stay deterministic.
 */
export function normalizeGenreIds(raw: unknown): number[] {
  const values = Array.isArray(raw) ? raw : [raw];
  const normalized: number[] = [];
  const seen = new Set<number>();

  for (const value of values) {
    const parts = typeof value === "string" ? value.split(",") : [value];
    for (const part of parts) {
      const id =
        typeof part === "number"
          ? part
          : typeof part === "string" && part.trim() !== ""
            ? Number(part.trim())
            : Number.NaN;

      if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      normalized.push(id);
      if (normalized.length >= MAX_SELECTED_GENRES) return normalized;
    }
  }

  return normalized;
}

/** Builds the explicit search-intent URL used by Preferences → Movies. */
export function buildMoviesHref(genreIds: unknown): string {
  return buildMovieSearchHref(genreIds, []);
}

/** Builds a search URL carrying both official genres and keyword-backed topics. */
export function buildMovieSearchHref(
  genreIds: unknown,
  topicSlugs: unknown,
  providerIds: unknown = [],
  seriesGenreIds: unknown = [],
): string {
  const normalizedGenres = normalizeGenreIds(genreIds);
  const normalizedTopics = normalizeTopicSlugs(topicSlugs);
  const normalizedProviders = normalizeStreamingProviderIds(providerIds);
  const normalizedSeriesGenres = normalizeGenreIds(seriesGenreIds);
  const queryParts: string[] = [];
  if (normalizedGenres.length > 0) queryParts.push(`genres=${normalizedGenres.join(",")}`);
  if (normalizedTopics.length > 0) queryParts.push(`topics=${normalizedTopics.join(",")}`);
  if (normalizedProviders.length > 0) queryParts.push(`providers=${normalizedProviders.join(",")}`);
  if (normalizedSeriesGenres.length > 0) {
    queryParts.push(`seriesGenres=${normalizedSeriesGenres.join(",")}`);
  }
  return queryParts.length > 0 ? `/movies?${queryParts.join("&")}` : "/movies";
}

/** Normalizes a TMDB list page to its documented range. */
export function normalizeMoviePage(raw: unknown): number {
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 500);
}

/** Builds the server endpoint used to append another page to MovieList. */
export function buildMovieFeedApiHref(
  page: unknown,
  genreIds: unknown,
  topicSlugs: unknown = [],
  providerIds: unknown = [],
  seriesGenreIds: unknown = [],
  mediaType: "movie" | "tv" = "movie",
): string {
  const params = new URLSearchParams({
    page: String(normalizeMoviePage(page)),
    mediaType,
  });
  const normalizedGenreIds = normalizeGenreIds(genreIds);
  const normalizedTopics = normalizeTopicSlugs(topicSlugs);
  const normalizedProviders = normalizeStreamingProviderIds(providerIds);
  const normalizedSeriesGenres = normalizeGenreIds(seriesGenreIds);
  if (normalizedGenreIds.length > 0) {
    params.set("genres", normalizedGenreIds.join(","));
  }
  if (normalizedTopics.length > 0) {
    params.set("topics", normalizedTopics.join(","));
  }
  if (normalizedProviders.length > 0) {
    params.set("providers", normalizedProviders.join(","));
  }
  if (normalizedSeriesGenres.length > 0) {
    params.set("seriesGenres", normalizedSeriesGenres.join(","));
  }
  return `/api/tmdb/feed?${params.toString()}`;
}

/** Appends new movies while preserving order and removing duplicate IDs. */
export function mergeMoviesById<T extends { id: number }>(
  current: readonly T[],
  incoming: readonly T[],
): T[] {
  const seen = new Set(current.map((movie) => movie.id));
  return [...current, ...incoming.filter((movie) => !seen.has(movie.id) && seen.add(movie.id))];
}

/**
 * Serializes genres using TMDB Discover syntax. A comma means AND (the movie
 * must contain every selected genre); a pipe means OR (any selected genre).
 */
export function serializeDiscoverGenres(
  genreIds: unknown,
  matchMode: GenreMatchMode = "any",
): string {
  const separator = matchMode === "all" ? "," : "|";
  return normalizeGenreIds(genreIds).join(separator);
}

/** True only when the movie contains every selected genre. */
export function movieMatchesAllGenres(
  movie: Pick<TMDBMovie, "genre_ids">,
  selectedGenreIds: unknown,
): boolean {
  const required = normalizeGenreIds(selectedGenreIds);
  if (required.length === 0) return true;

  const movieGenres = new Set(normalizeGenreIds(movie.genre_ids));
  return required.every((genreId) => movieGenres.has(genreId));
}

/**
 * Defense-in-depth for the explicit Movies search flow. Even if an upstream
 * response contains a loose match, no movie missing one of the selected
 * genres reaches the UI.
 */
export function filterMoviesByAllGenres<T extends Pick<TMDBMovie, "genre_ids">>(
  movies: readonly T[] | null | undefined,
  selectedGenreIds: unknown,
): T[] {
  if (!Array.isArray(movies)) return [];
  return movies.filter((movie) => movieMatchesAllGenres(movie, selectedGenreIds));
}
