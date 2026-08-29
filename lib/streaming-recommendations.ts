import type { TMDBMovie } from "@/types/tmdb";
import type { WatchProviderSummary } from "@/lib/watchProviders";

/**
 * Pure, deterministic scoring for "which TH streaming service best matches
 * this user's own movie interests" (Phase 3). Never imports from or
 * modifies lib/recommendations.ts - that's a separate, unrelated algorithm
 * (TMDB popular-movie ordering by genre preference).
 *
 * Internal weights exist only to rank providers. By design, no value
 * returned from this module carries the raw weighted score - UI-facing
 * output is limited to counts (matchCount, favoriteMatchCount,
 * watchedOnlyMatchCount) and a simple coverage percentage, which are
 * independently meaningful to a user ("8 movies match") in a way a blended
 * internal score is not.
 */

/** Favorites are the strongest signal (Phase 3 Part 2). */
export const FAVORITE_WEIGHT = 3;
/** Watched movies are a secondary signal. */
export const WATCHED_WEIGHT = 1;
/** Adds context on top of an existing favorite/watched signal - preferences never add a movie to the interest set by themselves. */
export const PREFERRED_GENRE_BONUS = 0.5;

/** Fewer than this many distinct interest movies -> no ranking at all ("insufficient"). Easy to retune. */
export const MIN_INTEREST_SET_SIZE = 3;
/** Fewer than this many -> a ranking IS shown, but flagged "low" confidence so the UI can hedge rather than overstate certainty. */
export const LOW_CONFIDENCE_THRESHOLD = 6;

export type RecommendationConfidence = "empty" | "insufficient" | "low" | "ready";

export interface UserMovieSignals {
  /** Strongest signal. */
  favoriteIds?: readonly number[] | null;
  /** Secondary signal. */
  watchedIds?: readonly number[] | null;
  /** Context only - never introduces a movie to the interest set on its own. */
  preferredGenreIds?: readonly number[] | null;
}

export interface ProviderMatch {
  providerId: number;
  providerName: string;
  logoPath: string | null;
  /** How many distinct interest-set movies stream on this provider in TH. */
  matchCount: number;
  /** Of matchCount, how many were favorites. */
  favoriteMatchCount: number;
  /** Of matchCount, how many were watched (and not also a favorite). */
  watchedOnlyMatchCount: number;
  /** matchCount / total interest-set size, 0-100, rounded. A personalization score, not a quality score. */
  coveragePercent: number;
  matchedMovies: TMDBMovie[];
}

export interface StreamingRecommendationResult {
  confidence: RecommendationConfidence;
  /** Distinct movies considered (favorites union watched), after dedup. */
  totalInterestSetSize: number;
  /** Ranked desc by internal weight, deterministic tie-break. Empty unless confidence is "low" or "ready" - and can still be empty even then, if nothing in the interest set streams in TH. */
  providers: ProviderMatch[];
}

function toIdSet(ids: readonly unknown[] | null | undefined): Set<number> {
  const set = new Set<number>();
  if (!Array.isArray(ids)) return set;
  for (const raw of ids) {
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (Number.isFinite(n)) set.add(n);
  }
  return set;
}

/**
 * A movie's weight and favorite/watched classification. A movie that is
 * both favorited and watched is weighted once, as a favorite only (Part 12:
 * no double counting).
 */
function weighMovie(
  movie: TMDBMovie,
  favoriteIds: Set<number>,
  watchedIds: Set<number>,
  preferredGenreIds: Set<number>,
): { weight: number; isFavorite: boolean } {
  const isFavorite = favoriteIds.has(movie.id);
  const isWatched = watchedIds.has(movie.id);
  let weight = isFavorite ? FAVORITE_WEIGHT : isWatched ? WATCHED_WEIGHT : 0;

  if (weight > 0 && preferredGenreIds.size > 0 && Array.isArray(movie.genre_ids)) {
    const hasPreferredGenre = movie.genre_ids.some((id) => preferredGenreIds.has(id));
    if (hasPreferredGenre) weight += PREFERRED_GENRE_BONUS;
  }

  return { weight, isFavorite };
}

/**
 * Ranks TH streaming providers by how well they match the user's own movie
 * interests (favorites + watched, weighted; preferences add context only).
 * Pure - never fetches, never throws, always returns a valid result for any
 * input shape.
 *
 * `interestMovies` should be the union of the user's favorited + watched
 * movies (deduped by the caller or not - this function dedupes defensively
 * either way). `providersByMovieId` should come from
 * summarizeWatchProvidersByMovie (TH region). Only the `streaming` bucket
 * (flatrate/free/ads) is considered; rent/buy are deliberately excluded,
 * since this answers "what should I subscribe to", not "what's available at
 * all".
 */
export function computeStreamingRecommendation(
  interestMovies: readonly TMDBMovie[] | null | undefined,
  providersByMovieId: Record<number, WatchProviderSummary> | null | undefined,
  signals: UserMovieSignals,
): StreamingRecommendationResult {
  const favoriteIds = toIdSet(signals.favoriteIds);
  const watchedIds = toIdSet(signals.watchedIds);
  const preferredGenreIds = toIdSet(signals.preferredGenreIds);

  // Dedupe by movie id, defensively - a movie favorited AND watched (or
  // passed twice by a careless caller) must only ever count once toward the
  // interest set.
  const uniqueMovies = new Map<number, TMDBMovie>();
  if (Array.isArray(interestMovies)) {
    for (const movie of interestMovies) {
      if (movie && typeof movie.id === "number" && !uniqueMovies.has(movie.id)) {
        uniqueMovies.set(movie.id, movie);
      }
    }
  }
  const totalInterestSetSize = uniqueMovies.size;

  if (totalInterestSetSize === 0) {
    return { confidence: "empty", totalInterestSetSize: 0, providers: [] };
  }
  if (totalInterestSetSize < MIN_INTEREST_SET_SIZE) {
    return { confidence: "insufficient", totalInterestSetSize, providers: [] };
  }

  interface ProviderAccumulator {
    providerId: number;
    providerName: string;
    logoPath: string | null;
    totalWeight: number;
    matchCount: number;
    favoriteMatchCount: number;
    watchedOnlyMatchCount: number;
    matchedMovies: TMDBMovie[];
  }

  const providerAgg = new Map<number, ProviderAccumulator>();

  for (const movie of uniqueMovies.values()) {
    const summary = providersByMovieId?.[movie.id];
    // Only subscription-style access counts (Part 3/11) - rent/buy-only
    // movies, and movies with no TH data at all (unavailable in Thailand),
    // contribute to the interest set's size but match no provider here.
    if (!summary?.streaming?.length) continue;

    const { weight, isFavorite } = weighMovie(movie, favoriteIds, watchedIds, preferredGenreIds);
    if (weight <= 0) continue; // defensive: expected callers only pass favorite/watched movies

    for (const provider of summary.streaming) {
      let entry = providerAgg.get(provider.provider_id);
      if (!entry) {
        entry = {
          providerId: provider.provider_id,
          providerName: provider.provider_name,
          logoPath: provider.logo_path,
          totalWeight: 0,
          matchCount: 0,
          favoriteMatchCount: 0,
          watchedOnlyMatchCount: 0,
          matchedMovies: [],
        };
        providerAgg.set(provider.provider_id, entry);
      }
      entry.totalWeight += weight;
      entry.matchCount += 1;
      if (isFavorite) {
        entry.favoriteMatchCount += 1;
      } else {
        entry.watchedOnlyMatchCount += 1;
      }
      entry.matchedMovies.push(movie);
    }
  }

  // Sort on the internal weight, then strip it - it never leaves this
  // function. matchCount desc, then providerName asc, give a fully
  // deterministic order even when totalWeight ties (Part 12).
  const ranked = [...providerAgg.values()].sort((a, b) => {
    if (b.totalWeight !== a.totalWeight) return b.totalWeight - a.totalWeight;
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return a.providerName.localeCompare(b.providerName);
  });

  const providers: ProviderMatch[] = ranked.map((entry) => ({
    providerId: entry.providerId,
    providerName: entry.providerName,
    logoPath: entry.logoPath,
    matchCount: entry.matchCount,
    favoriteMatchCount: entry.favoriteMatchCount,
    watchedOnlyMatchCount: entry.watchedOnlyMatchCount,
    coveragePercent: Math.round((entry.matchCount / totalInterestSetSize) * 100),
    matchedMovies: entry.matchedMovies,
  }));

  const confidence: RecommendationConfidence =
    totalInterestSetSize < LOW_CONFIDENCE_THRESHOLD ? "low" : "ready";

  return { confidence, totalInterestSetSize, providers };
}
