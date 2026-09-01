/**
 * Keeps the recommendation score order intact within each group, while
 * placing movies confirmed by TMDB's Thailand streaming discovery first.
 * Non-streaming candidates remain as a fallback when the streaming pool is
 * too small rather than leaving the page empty.
 */
export function prioritizeStreamingCandidates<T extends { movie: { id: number } }>(
  ranked: readonly T[],
  streamingMovieIds: readonly number[],
): T[] {
  const streamingIds = new Set(streamingMovieIds);
  return [
    ...ranked.filter((item) => streamingIds.has(item.movie.id)),
    ...ranked.filter((item) => !streamingIds.has(item.movie.id)),
  ];
}
