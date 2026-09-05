/**
 * Places movies confirmed by TMDB's Thailand streaming discovery first,
 * then orders each group by TMDB audience rating.
 * Non-streaming candidates remain as a fallback when the streaming pool is
 * too small rather than leaving the page empty.
 */
export function prioritizeStreamingCandidates<
  T extends { movie: { id: number; vote_average: number; vote_count: number } },
>(
  ranked: readonly T[],
  streamingMovieIds: readonly number[],
): T[] {
  const streamingIds = new Set(streamingMovieIds);
  const byRating = (left: T, right: T) =>
    right.movie.vote_average - left.movie.vote_average ||
    right.movie.vote_count - left.movie.vote_count ||
    left.movie.id - right.movie.id;
  return [
    ...ranked.filter((item) => streamingIds.has(item.movie.id)).sort(byRating),
    ...ranked.filter((item) => !streamingIds.has(item.movie.id)).sort(byRating),
  ];
}
