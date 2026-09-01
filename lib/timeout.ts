// Generic "don't wait forever" helper. Not TMDB-specific - a promise that
// takes too long (or rejects) resolves to a caller-supplied fallback instead
// of blocking or throwing. Used to bound how long app/movies/page.tsx waits
// on watch-provider enrichment, which is nice-to-have (badges) and must
// never hold up the movie grid indefinitely.

/**
 * Races `promise` against a timeout. If `promise` settles (resolves OR
 * rejects) before `timeoutMs` elapses, its resolved value is returned - a
 * rejection is treated the same as "too slow", both fall back, since from
 * the caller's perspective either way there's no real data to use. If
 * neither happens in time, `fallback` is returned once the timeout fires.
 *
 * Does not cancel/abort `promise` - it keeps running in the background,
 * just no longer awaited. Fine for calls that are already safe to abandon
 * (e.g. getWatchProvidersForMovies, which never throws and has no
 * side effects of its own).
 */
export async function withTimeoutFallback<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}
