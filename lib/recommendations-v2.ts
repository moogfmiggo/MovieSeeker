// Recommendation Engine v2 (Phase 4). Pure, deterministic, synchronous -
// same testing/architecture philosophy as lib/streaming-recommendations.ts:
// this module never fetches anything and never calls an LLM. All TMDB
// fetching lives in lib/tmdb.ts / app/api/recommendations/candidates; all
// Thai sentence templates live in lib/i18n.ts. This module only turns
// "candidates + user signals" into "ranked, explained, excluded" results.
//
// Deliberately additive: lib/recommendations.ts (v1, genre-only) is
// untouched and keeps powering MovieList/@/movies exactly as before.

import type { TMDBMovie } from "@/types/tmdb";

// ---------------------------------------------------------------------------
// Candidate provenance (INPUT: why a candidate entered the pool at all)
// ---------------------------------------------------------------------------

export type MatchedSignal =
  | { type: "favoriteGenre"; genreId: number }
  | { type: "favoriteSimilarity"; favoriteMovieId: number; favoriteTitle: string }
  | { type: "directorAffinity"; personId: number; personName: string }
  | { type: "actorAffinity"; personId: number; personName: string }
  | { type: "companyAffinity"; companyId: number; companyName: string }
  /** Generic provenance (preferred-genre discover, popularity fallback, ...).
   *  Carries no scoring weight of its own - genre/popularity/vote scoring is
   *  derived directly from the candidate's own fields regardless of which
   *  pool surfaced it, so this exists only to get the movie into the pool. */
  | { type: "discoverPool" };

export interface CandidateMovie extends TMDBMovie {
  matchedSignals: MatchedSignal[];
}

// ---------------------------------------------------------------------------
// Match reasons (OUTPUT: Part 6 - why we're telling the user this)
// ---------------------------------------------------------------------------

export type MatchReason =
  | { type: "preferredGenre"; genreName: string }
  | { type: "favoriteGenre"; genreName: string }
  | { type: "favoriteSimilarity"; favoriteTitle: string }
  | { type: "directorAffinity"; personName: string }
  | { type: "actorAffinity"; personName: string }
  | { type: "companyAffinity"; companyName: string }
  | { type: "popular" };

export interface ScoredMovie {
  movie: TMDBMovie;
  /** 0-100. "Personalization match" only - never quality/popularity (Part 7). */
  score: number;
  /** De-duplicated, strongest-first. Always at least one entry. */
  reasons: MatchReason[];
  primaryReason: MatchReason;
}

// ---------------------------------------------------------------------------
// Profile state (Part 2, States A-D)
// ---------------------------------------------------------------------------

export type ProfileState = "new" | "preferencesOnly" | "someInteraction" | "strong";

/** Favorites at/above this count -> "strong" (State D), regardless of watched count. */
export const STRONG_PROFILE_MIN_FAVORITES = 5;

/**
 * Candidate-generation bounds (Part 20 - avoid N+1 / fetching hundreds of
 * movies). Both take the most *recently added* favorites (the end of the
 * array - lib/favorites.ts appends new ids), since recent taste is more
 * relevant than a large historical list.
 */
export const MAX_FAVORITES_FOR_CREDIT_SIGNALS = 10;
export const MAX_FAVORITES_FOR_SIMILARITY = 5;

export function determineProfileState(input: {
  preferredGenreIds?: readonly number[] | null;
  favoriteIds?: readonly number[] | null;
  watchedIds?: readonly number[] | null;
}): ProfileState {
  const favorites = Array.isArray(input.favoriteIds) ? input.favoriteIds.length : 0;
  const watched = Array.isArray(input.watchedIds) ? input.watchedIds.length : 0;
  const preferences = Array.isArray(input.preferredGenreIds) ? input.preferredGenreIds.length : 0;

  if (favorites >= STRONG_PROFILE_MIN_FAVORITES) return "strong";
  if (favorites > 0 || watched > 0) return "someInteraction";
  if (preferences > 0) return "preferencesOnly";
  return "new";
}

// ---------------------------------------------------------------------------
// Candidate pool merging (Part 3 - candidate generation)
// ---------------------------------------------------------------------------

export interface CandidatePool {
  movies: readonly TMDBMovie[] | null | undefined;
  signal: MatchedSignal;
}

/**
 * Merges tagged candidate pools (each pool = the result of one TMDB call,
 * tagged with *why* it was fetched) into one deduped list. A movie surfaced
 * by two different pools (e.g. matches a preferred genre AND a favorited
 * director) keeps both signals rather than one overwriting the other.
 * Pure - no fetching. Order of the returned array is insertion order, not
 * significant (rankRecommendations re-sorts).
 */
export function mergeCandidatePools(pools: readonly CandidatePool[] | null | undefined): CandidateMovie[] {
  if (!Array.isArray(pools)) return [];
  const byId = new Map<number, CandidateMovie>();
  for (const pool of pools) {
    if (!pool || !Array.isArray(pool.movies)) continue;
    for (const movie of pool.movies) {
      if (!movie || typeof movie.id !== "number" || !Number.isFinite(movie.id)) continue;
      const existing = byId.get(movie.id);
      if (existing) {
        existing.matchedSignals.push(pool.signal);
      } else {
        byId.set(movie.id, { ...movie, matchedSignals: [pool.signal] });
      }
    }
  }
  return [...byId.values()];
}

// ---------------------------------------------------------------------------
// Favorite affinity extraction (which directors/actors/companies/genres the
// user's favorites lean toward - used by the candidates route to decide
// which discover queries to run, and reusable for single-movie explanations)
// ---------------------------------------------------------------------------

export interface FavoriteSignalSource {
  genreIds: readonly number[] | null | undefined;
  directors: readonly { id: number; name: string }[] | null | undefined;
  /** Already limited to top-billed by the caller - this module doesn't re-sort billing. */
  topCast: readonly { id: number; name: string }[] | null | undefined;
  companies: readonly { id: number; name: string }[] | null | undefined;
}

export interface AffinityProfile {
  /** Ranked by frequency desc, genre id asc tie-break. */
  topGenreIds: number[];
  topDirector: { id: number; name: string } | null;
  topActor: { id: number; name: string } | null;
  topCompany: { id: number; name: string } | null;
}

function topByFrequency<T extends { id: number; name: string }>(
  counts: Map<number, { entry: T; count: number }>,
): T | null {
  let best: { entry: T; count: number } | null = null;
  for (const candidate of counts.values()) {
    if (
      !best ||
      candidate.count > best.count ||
      (candidate.count === best.count && candidate.entry.id < best.entry.id)
    ) {
      best = candidate;
    }
  }
  return best?.entry ?? null;
}

/** Pure. Never invents affinities - only counts what's actually present in `sources`. */
export function buildAffinityProfile(sources: readonly FavoriteSignalSource[] | null | undefined): AffinityProfile {
  const genreCounts = new Map<number, number>();
  const directorCounts = new Map<number, { entry: { id: number; name: string }; count: number }>();
  const actorCounts = new Map<number, { entry: { id: number; name: string }; count: number }>();
  const companyCounts = new Map<number, { entry: { id: number; name: string }; count: number }>();

  for (const source of Array.isArray(sources) ? sources : []) {
    if (!source) continue;
    for (const gid of Array.isArray(source.genreIds) ? source.genreIds : []) {
      if (typeof gid === "number" && Number.isFinite(gid)) {
        genreCounts.set(gid, (genreCounts.get(gid) ?? 0) + 1);
      }
    }
    for (const d of Array.isArray(source.directors) ? source.directors : []) {
      if (!d || typeof d.id !== "number") continue;
      const prev = directorCounts.get(d.id);
      directorCounts.set(d.id, { entry: { id: d.id, name: d.name }, count: (prev?.count ?? 0) + 1 });
    }
    for (const c of Array.isArray(source.topCast) ? source.topCast : []) {
      if (!c || typeof c.id !== "number") continue;
      const prev = actorCounts.get(c.id);
      actorCounts.set(c.id, { entry: { id: c.id, name: c.name }, count: (prev?.count ?? 0) + 1 });
    }
    for (const co of Array.isArray(source.companies) ? source.companies : []) {
      if (!co || typeof co.id !== "number") continue;
      const prev = companyCounts.get(co.id);
      companyCounts.set(co.id, { entry: { id: co.id, name: co.name }, count: (prev?.count ?? 0) + 1 });
    }
  }

  const topGenreIds = [...genreCounts.entries()]
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0] - b[0]))
    .map(([id]) => id);

  return {
    topGenreIds,
    topDirector: topByFrequency(directorCounts),
    topActor: topByFrequency(actorCounts),
    topCompany: topByFrequency(companyCounts),
  };
}

// ---------------------------------------------------------------------------
// Scoring (Part 4 - explicit ranking model)
// ---------------------------------------------------------------------------
// Internal weights - never exposed to the UI (Part 7). Favorite-derived
// signals dominate; popularity/vote are small secondary nudges only.
// Watched movies contribute no scoring weight to *other* candidates - Part 4
// is explicit that watched is context, not a positive preference, so it's
// used only for exclusion and for determineProfileState above.

const GENRE_MATCH_POINTS = 12;
const GENRE_MATCH_MAX_GENRES = 2;
const FAVORITE_GENRE_POINTS = 10;
const FAVORITE_SIMILARITY_POINTS = 30;
const DIRECTOR_AFFINITY_POINTS = 22;
const ACTOR_AFFINITY_POINTS = 16;
const COMPANY_AFFINITY_POINTS = 8;
const POPULARITY_MAX_POINTS = 10;
const POPULARITY_NORMALIZER = 300;
const VOTE_MAX_POINTS = 10;
const MIN_VOTE_COUNT_FOR_VOTE_SIGNAL = 20;

function reasonKey(reason: MatchReason): string {
  switch (reason.type) {
    case "preferredGenre":
    case "favoriteGenre":
      return `${reason.type}:${reason.genreName}`;
    case "favoriteSimilarity":
      return `${reason.type}:${reason.favoriteTitle}`;
    case "directorAffinity":
    case "actorAffinity":
      return `${reason.type}:${reason.personName}`;
    case "companyAffinity":
      return `${reason.type}:${reason.companyName}`;
    case "popular":
      return "popular";
  }
}

function addReason(reasons: MatchReason[], seenKeys: Set<string>, reason: MatchReason): void {
  const key = reasonKey(reason);
  if (seenKeys.has(key)) return;
  seenKeys.add(key);
  reasons.push(reason);
}

function toPlainMovie(candidate: CandidateMovie): TMDBMovie {
  return {
    id: candidate.id,
    title: candidate.title,
    overview: candidate.overview,
    poster_path: candidate.poster_path,
    backdrop_path: candidate.backdrop_path,
    release_date: candidate.release_date,
    vote_average: candidate.vote_average,
    vote_count: candidate.vote_count,
    popularity: candidate.popularity,
    genre_ids: candidate.genre_ids,
    original_language: candidate.original_language,
    original_title: candidate.original_title,
    adult: candidate.adult,
    video: candidate.video,
  };
}

/**
 * Scores a single candidate against the user's preferred genres. Exported
 * for reuse (e.g. explaining a single already-loaded movie on its detail
 * page) as well as being the unit rankRecommendations calls per-candidate.
 */
export function scoreCandidateMovie(
  candidate: CandidateMovie,
  preferredGenreIds: ReadonlySet<number> | readonly number[] | null | undefined,
  genreMap: Record<number, string> | null | undefined,
): ScoredMovie {
  const prefSet = preferredGenreIds instanceof Set ? preferredGenreIds : new Set(preferredGenreIds ?? []);
  const map = genreMap ?? {};
  const reasons: MatchReason[] = [];
  const seenKeys = new Set<string>();
  let points = 0;

  const genreIds = Array.isArray(candidate.genre_ids) ? candidate.genre_ids : [];
  let genreMatches = 0;
  for (const gid of genreIds) {
    if (genreMatches >= GENRE_MATCH_MAX_GENRES) break;
    if (prefSet.has(gid)) {
      points += GENRE_MATCH_POINTS;
      genreMatches++;
      addReason(reasons, seenKeys, { type: "preferredGenre", genreName: map[gid] ?? String(gid) });
    }
  }

  for (const signal of Array.isArray(candidate.matchedSignals) ? candidate.matchedSignals : []) {
    switch (signal.type) {
      case "favoriteGenre":
        points += FAVORITE_GENRE_POINTS;
        addReason(reasons, seenKeys, { type: "favoriteGenre", genreName: map[signal.genreId] ?? String(signal.genreId) });
        break;
      case "favoriteSimilarity":
        points += FAVORITE_SIMILARITY_POINTS;
        addReason(reasons, seenKeys, { type: "favoriteSimilarity", favoriteTitle: signal.favoriteTitle });
        break;
      case "directorAffinity":
        points += DIRECTOR_AFFINITY_POINTS;
        addReason(reasons, seenKeys, { type: "directorAffinity", personName: signal.personName });
        break;
      case "actorAffinity":
        points += ACTOR_AFFINITY_POINTS;
        addReason(reasons, seenKeys, { type: "actorAffinity", personName: signal.personName });
        break;
      case "companyAffinity":
        points += COMPANY_AFFINITY_POINTS;
        addReason(reasons, seenKeys, { type: "companyAffinity", companyName: signal.companyName });
        break;
      case "discoverPool":
        break;
    }
  }

  const popularity = Number.isFinite(candidate.popularity) ? candidate.popularity : 0;
  points += Math.min(Math.max(popularity, 0) / POPULARITY_NORMALIZER, 1) * POPULARITY_MAX_POINTS;

  const voteAverage = Number.isFinite(candidate.vote_average) ? candidate.vote_average : 0;
  const voteCount = Number.isFinite(candidate.vote_count) ? candidate.vote_count : 0;
  if (voteCount >= MIN_VOTE_COUNT_FOR_VOTE_SIGNAL) {
    points += (Math.min(Math.max(voteAverage, 0), 10) / 10) * VOTE_MAX_POINTS;
  }

  if (reasons.length === 0) {
    reasons.push({ type: "popular" });
  }

  return {
    movie: toPlainMovie(candidate),
    score: Math.max(0, Math.min(100, Math.round(points))),
    reasons,
    primaryReason: reasons[0],
  };
}

// ---------------------------------------------------------------------------
// Ranking (excludes watched + dismissed, scores, sorts deterministically)
// ---------------------------------------------------------------------------

export interface RankingContext {
  preferredGenreIds?: readonly number[] | null;
  watchedIds?: readonly number[] | null;
  dismissedIds?: readonly number[] | null;
  genreMap?: Record<number, string> | null;
}

/**
 * Ranks candidates for display. Pure, deterministic: same inputs always
 * produce the same output order. Never mutates `candidates`.
 *
 * - Watched and dismissed movies are excluded entirely (never scored, never
 *   returned) - Part 4/Part 5.
 * - Duplicate candidate ids are merged (signals combined) defensively, in
 *   case a caller passes an already-partially-merged list.
 * - Sort: score desc, then movie id asc (deterministic tie-break, matching
 *   the convention in lib/recommendations.ts).
 */
export function rankRecommendations(
  candidates: readonly CandidateMovie[] | null | undefined,
  context: RankingContext = {},
): ScoredMovie[] {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  const watchedSet = new Set(Array.isArray(context.watchedIds) ? context.watchedIds : []);
  const dismissedSet = new Set(Array.isArray(context.dismissedIds) ? context.dismissedIds : []);
  const prefSet = new Set(Array.isArray(context.preferredGenreIds) ? context.preferredGenreIds : []);
  const genreMap = context.genreMap ?? {};

  const byId = new Map<number, CandidateMovie>();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate.id !== "number" || !Number.isFinite(candidate.id)) continue;
    if (watchedSet.has(candidate.id) || dismissedSet.has(candidate.id)) continue;
    const existing = byId.get(candidate.id);
    if (existing) {
      existing.matchedSignals.push(...(Array.isArray(candidate.matchedSignals) ? candidate.matchedSignals : []));
    } else {
      byId.set(candidate.id, { ...candidate, matchedSignals: [...(candidate.matchedSignals ?? [])] });
    }
  }

  return [...byId.values()]
    .map((candidate) => scoreCandidateMovie(candidate, prefSet, genreMap))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.movie.id - b.movie.id));
}
