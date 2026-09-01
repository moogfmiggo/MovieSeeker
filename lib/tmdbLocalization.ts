import type { TMDBMovie, TMDBPopularMoviesResponse } from "../types/tmdb";

export interface LocalizedMovieText {
  id: number;
  title: string;
  overview: string;
  original_title: string;
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Whether a Thai response needs one bounded English fallback request. */
export function needsEnglishMovieFallback(movie: LocalizedMovieText): boolean {
  return !nonBlank(movie.title) || !nonBlank(movie.overview);
}

/**
 * Keeps Thai text when present, fills only missing fields from English, then
 * falls back to the original title. No machine translation or invented copy.
 */
export function mergeLocalizedMovieText<T extends LocalizedMovieText>(
  thai: T,
  english?: LocalizedMovieText | null,
): T {
  return {
    ...thai,
    title: nonBlank(thai.title)
      ? thai.title
      : nonBlank(english?.title)
        ? english.title
        : nonBlank(thai.original_title)
          ? thai.original_title
          : english?.original_title ?? "",
    overview: nonBlank(thai.overview)
      ? thai.overview
      : nonBlank(english?.overview)
        ? english.overview
        : "",
  };
}

/** Merge a Thai-first list without changing its ordering or pagination. */
export function mergeLocalizedMoviePage(
  thai: TMDBPopularMoviesResponse,
  english?: TMDBPopularMoviesResponse | null,
): TMDBPopularMoviesResponse {
  const englishById = new Map((english?.results ?? []).map((movie) => [movie.id, movie]));
  return {
    ...thai,
    results: thai.results.map((movie) =>
      mergeLocalizedMovieText(movie, englishById.get(movie.id)),
    ),
  };
}

export function moviePageNeedsEnglishFallback(page: TMDBPopularMoviesResponse): boolean {
  return page.results.some(needsEnglishMovieFallback);
}

/** Merge movie-credit arrays by TMDB ID while preserving Thai ordering. */
export function mergeLocalizedMovies<T extends TMDBMovie>(
  thai: readonly T[],
  english: readonly TMDBMovie[] = [],
): T[] {
  const englishById = new Map(english.map((movie) => [movie.id, movie]));
  return thai.map((movie) => mergeLocalizedMovieText(movie, englishById.get(movie.id)));
}
