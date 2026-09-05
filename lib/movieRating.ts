import type { TMDBMovie, TMDBPopularMoviesResponse } from "@/types/tmdb";

/**
 * Highest TMDB audience score first. Vote count resolves equal scores, then
 * popularity and ID keep the order stable and deterministic.
 */
export function sortMoviesByRating<T extends TMDBMovie>(movies: readonly T[]): T[] {
  return [...movies].sort((left, right) =>
    right.vote_average - left.vote_average ||
    right.vote_count - left.vote_count ||
    right.popularity - left.popularity ||
    left.id - right.id,
  );
}

export function sortMoviePageByRating(
  page: TMDBPopularMoviesResponse,
): TMDBPopularMoviesResponse {
  return { ...page, results: sortMoviesByRating(page.results) };
}
