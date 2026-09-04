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
  /** v3 (Discovery v3 Part 1) - candidate surfaced via a keyword/theme
   *  discover pool built from the user's favorites. Uses the same
   *  no-per-candidate-fetch pattern as director/actor/company affinity. */
  | { type: "keywordAffinity"; keywordId: number; keywordName: string }
  | { type: "negativeDirectorAffinity"; personId: number; personName: string }
  | { type: "negativeActorAffinity"; personId: number; personName: string }
  | { type: "negativeCompanyAffinity"; companyId: number; companyName: string }
  | { type: "negativeKeywordAffinity"; keywordId: number; keywordName: string }
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
  | { type: "keywordAffinity"; keywordName: string }
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
/** v3 - same bound, applied to dismissed movies for negative-genre extraction. */
export const MAX_DISMISSED_FOR_NEGATIVE_SIGNAL = 10;
/** Avoid inferring a rich dislike from one dismissed movie alone. */
export const MIN_RICH_NEGATIVE_OCCURRENCES = 2;

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

function matchedSignalKey(signal: MatchedSignal): string {
  switch (signal.type) {
    case "favoriteGenre":
      return `${signal.type}:${signal.genreId}`;
    case "favoriteSimilarity":
      return `${signal.type}:${signal.favoriteMovieId}`;
    case "directorAffinity":
    case "actorAffinity":
    case "negativeDirectorAffinity":
    case "negativeActorAffinity":
      return `${signal.type}:${signal.personId}`;
    case "companyAffinity":
    case "negativeCompanyAffinity":
      return `${signal.type}:${signal.companyId}`;
    case "keywordAffinity":
    case "negativeKeywordAffinity":
      return `${signal.type}:${signal.keywordId}`;
    case "discoverPool":
      return signal.type;
  }
}

/**
 * Adds signals only to candidates that already entered through a positive
 * pool. This is crucial for negative discovery pools: they may identify
 * disliked characteristics, but must never introduce disliked movies into
 * the recommendation feed merely so they can be penalized.
 */
export function attachSignalsToExistingCandidates(
  candidates: readonly CandidateMovie[] | null | undefined,
  signalPools: readonly CandidatePool[] | null | undefined,
): CandidateMovie[] {
  if (!Array.isArray(candidates)) return [];
  const result: CandidateMovie[] = (candidates as readonly CandidateMovie[]).map((candidate) => ({
    ...candidate,
    matchedSignals: [...(candidate.matchedSignals ?? [])],
  }));
  if (!Array.isArray(signalPools) || signalPools.length === 0) return result;

  const byId = new Map(result.map((candidate) => [candidate.id, candidate]));
  for (const pool of signalPools) {
    if (!pool || !Array.isArray(pool.movies)) continue;
    const signalKey = matchedSignalKey(pool.signal);
    for (const movie of pool.movies) {
      const candidate = byId.get(movie?.id);
      if (!candidate) continue;
      const alreadyAttached = candidate.matchedSignals.some(
        (signal) => matchedSignalKey(signal) === signalKey,
      );
      if (!alreadyAttached) candidate.matchedSignals.push(pool.signal);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Affinity extraction (which directors/actors/companies/genres/keywords a
// set of movies leans toward). Used for BOTH polarities in v3: favorites
// build a positive AffinityProfile, dismissed movies build a negative one -
// same pure counting logic either way, so this isn't favorite-specific
// anymore (renamed from FavoriteSignalSource in v2).
// ---------------------------------------------------------------------------

export interface MovieSignalSource {
  genreIds: readonly number[] | null | undefined;
  directors: readonly { id: number; name: string }[] | null | undefined;
  /** Already limited to top-billed by the caller - this module doesn't re-sort billing. */
  topCast: readonly { id: number; name: string }[] | null | undefined;
  companies: readonly { id: number; name: string }[] | null | undefined;
  /** v3 - keywords/themes (Part 1). Optional: older cached data or a TMDB
   *  response without append_to_response=keywords simply contributes none.
   *  Carries names (unlike genreIds) because - unlike genres - there's no
   *  separate global keyword-name catalog fetched elsewhere to resolve ids
   *  against later; the name is only ever known at the point of extraction. */
  keywords?: readonly { id: number; name: string }[] | null;
}

export interface AffinityProfile {
  /** Ranked by frequency desc, genre id asc tie-break. */
  topGenreIds: number[];
  topDirector: { id: number; name: string } | null;
  topActor: { id: number; name: string } | null;
  topCompany: { id: number; name: string } | null;
  /** v3 - ranked by frequency desc, keyword id asc tie-break. */
  topKeywords: { id: number; name: string }[];
}

export type AffinityDimension = "director" | "actor" | "company" | "keyword";

/** Counts in how many source movies an affinity appears (not raw duplicate entries). */
export function affinityOccurrenceCount(
  sources: readonly MovieSignalSource[] | null | undefined,
  dimension: AffinityDimension,
  id: number,
): number {
  if (!Array.isArray(sources)) return 0;
  return (sources as readonly MovieSignalSource[]).reduce((count, source) => {
    const entries = dimension === "director"
      ? source.directors
      : dimension === "actor"
        ? source.topCast
        : dimension === "company"
          ? source.companies
          : source.keywords;
    return count + (Array.isArray(entries) && entries.some((entry) => entry?.id === id) ? 1 : 0);
  }, 0);
}

function topByFrequency<T extends { id: number; name: string }>(
  counts: Map<number, { entry: T; count: number }>,
): T | null {
  return rankByFrequency(counts)[0] ?? null;
}

/** Frequency desc, then entry id asc (deterministic tie-break) - shared by every affinity dimension. */
function rankByFrequency<T extends { id: number; name: string }>(
  counts: Map<number, { entry: T; count: number }>,
): T[] {
  return [...counts.values()]
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.entry.id - b.entry.id))
    .map((c) => c.entry);
}

/** Pure. Never invents affinities - only counts what's actually present in `sources`. */
export function buildAffinityProfile(sources: readonly MovieSignalSource[] | null | undefined): AffinityProfile {
  const genreCounts = new Map<number, number>();
  const keywordCounts = new Map<number, { entry: { id: number; name: string }; count: number }>();
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
    for (const k of Array.isArray(source.keywords) ? source.keywords : []) {
      if (!k || typeof k.id !== "number") continue;
      const prev = keywordCounts.get(k.id);
      keywordCounts.set(k.id, { entry: { id: k.id, name: k.name }, count: (prev?.count ?? 0) + 1 });
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
    topKeywords: rankByFrequency(keywordCounts),
    topDirector: topByFrequency(directorCounts),
    topActor: topByFrequency(actorCounts),
    topCompany: topByFrequency(companyCounts),
  };
}

// ---------------------------------------------------------------------------
// Scoring (Part 4 - explicit ranking model; rebalanced for Discovery v3 Part 1)
// ---------------------------------------------------------------------------
// Centralized, single source of truth for every point value - never scattered
// across components, never exposed to the UI (Part 7 / v3 Part 6). Favorite-
// derived affinity signals (similarity/director/actor/keyword) dominate;
// genre is deliberately now one of the *smallest* contributors (v3 Part 1:
// "genres must no longer be the primary signal... genres as a secondary
// signal") - contrast with v2, where genre and favorite-genre were roughly
// on par with company affinity. Popularity/vote are small secondary nudges.
// Watched movies contribute no scoring weight to *other* candidates (Part 4:
// watched is context, not a positive preference - used only for exclusion
// and determineProfileState). Dismissed movies now DO contribute a negative
// genre signal and bounded negative director/actor/company/keyword pools.
export const SCORING_WEIGHTS = {
  /** Per matching preferred/explicit genre, capped at genreMatchMaxGenres. */
  genreMatch: 6,
  genreMatchMaxGenres: 2,
  /** Per matching genre frequent among the user's favorites but not explicitly preferred. */
  favoriteGenre: 6,
  /** A TMDB-recommended-from-favorite hit - the strongest single positive signal (real movie-to-movie similarity, not genre). */
  favoriteSimilarity: 30,
  directorAffinity: 22,
  actorAffinity: 16,
  companyAffinity: 8,
  /** v3 - keyword/theme overlap with favorites. Deliberately high: this is the "movie characteristics" signal meant to help replace over-reliance on genre. */
  keywordAffinity: 20,
  popularityMax: 8,
  popularityNormalizer: 300,
  voteMax: 8,
  minVoteCountForVoteSignal: 20,
  /** v3 - per matching genre frequent among the user's dismissed movies, capped at negativeGenreMaxGenres. Always <= 0. */
  negativeGenre: -10,
  negativeGenreMaxGenres: 2,
  /** Negative affinities are silent ranking signals, never UI explanations. */
  negativeDirectorAffinity: -14,
  negativeActorAffinity: -10,
  negativeCompanyAffinity: -5,
  negativeKeywordAffinity: -12,
} as const;

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
    case "keywordAffinity":
      return `${reason.type}:${reason.keywordName}`;
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
 * Scores a single candidate against the user's preferred genres and (v3)
 * negative-genre affinity. Exported for reuse (e.g. explaining a single
 * already-loaded movie on its detail page) as well as being the unit
 * rankRecommendations calls per-candidate.
 *
 * Rich negative affinity is attached upstream from bounded TMDB discovery
 * pools. That avoids fetching credits/keywords for every candidate (N+1)
 * while still knowing when an existing positive candidate shares a disliked
 * director, actor, company, or keyword.
 */
export function scoreCandidateMovie(
  candidate: CandidateMovie,
  preferredGenreIds: ReadonlySet<number> | readonly number[] | null | undefined,
  genreMap: Record<number, string> | null | undefined,
  negativeGenreIds?: ReadonlySet<number> | readonly number[] | null,
): ScoredMovie {
  const prefSet = preferredGenreIds instanceof Set ? preferredGenreIds : new Set(preferredGenreIds ?? []);
  const negativeSet = negativeGenreIds instanceof Set ? negativeGenreIds : new Set(negativeGenreIds ?? []);
  const map = genreMap ?? {};
  const reasons: MatchReason[] = [];
  const seenKeys = new Set<string>();
  let points = 0;

  const genreIds = Array.isArray(candidate.genre_ids) ? candidate.genre_ids : [];

  let genreMatches = 0;
  for (const gid of genreIds) {
    if (genreMatches >= SCORING_WEIGHTS.genreMatchMaxGenres) break;
    if (prefSet.has(gid)) {
      points += SCORING_WEIGHTS.genreMatch;
      genreMatches++;
      addReason(reasons, seenKeys, { type: "preferredGenre", genreName: map[gid] ?? String(gid) });
    }
  }

  // v3 - negative genre affinity. Silent (no MatchReason - Part 6's
  // explanations are for why something WAS recommended; a penalty isn't a
  // "reason to recommend" and Part 6 explicitly warns against unsupported/
  // fabricated reasons, so this only ever subtracts points, never explains).
  let negativeGenreMatches = 0;
  for (const gid of genreIds) {
    if (negativeGenreMatches >= SCORING_WEIGHTS.negativeGenreMaxGenres) break;
    if (negativeSet.has(gid)) {
      points += SCORING_WEIGHTS.negativeGenre;
      negativeGenreMatches++;
    }
  }

  for (const signal of Array.isArray(candidate.matchedSignals) ? candidate.matchedSignals : []) {
    switch (signal.type) {
      case "favoriteGenre":
        points += SCORING_WEIGHTS.favoriteGenre;
        addReason(reasons, seenKeys, { type: "favoriteGenre", genreName: map[signal.genreId] ?? String(signal.genreId) });
        break;
      case "favoriteSimilarity":
        points += SCORING_WEIGHTS.favoriteSimilarity;
        addReason(reasons, seenKeys, { type: "favoriteSimilarity", favoriteTitle: signal.favoriteTitle });
        break;
      case "directorAffinity":
        points += SCORING_WEIGHTS.directorAffinity;
        addReason(reasons, seenKeys, { type: "directorAffinity", personName: signal.personName });
        break;
      case "actorAffinity":
        points += SCORING_WEIGHTS.actorAffinity;
        addReason(reasons, seenKeys, { type: "actorAffinity", personName: signal.personName });
        break;
      case "companyAffinity":
        points += SCORING_WEIGHTS.companyAffinity;
        addReason(reasons, seenKeys, { type: "companyAffinity", companyName: signal.companyName });
        break;
      case "keywordAffinity":
        points += SCORING_WEIGHTS.keywordAffinity;
        addReason(reasons, seenKeys, { type: "keywordAffinity", keywordName: signal.keywordName });
        break;
      case "negativeDirectorAffinity":
        points += SCORING_WEIGHTS.negativeDirectorAffinity;
        break;
      case "negativeActorAffinity":
        points += SCORING_WEIGHTS.negativeActorAffinity;
        break;
      case "negativeCompanyAffinity":
        points += SCORING_WEIGHTS.negativeCompanyAffinity;
        break;
      case "negativeKeywordAffinity":
        points += SCORING_WEIGHTS.negativeKeywordAffinity;
        break;
      case "discoverPool":
        break;
    }
  }

  const popularity = Number.isFinite(candidate.popularity) ? candidate.popularity : 0;
  points += Math.min(Math.max(popularity, 0) / SCORING_WEIGHTS.popularityNormalizer, 1) * SCORING_WEIGHTS.popularityMax;

  const voteAverage = Number.isFinite(candidate.vote_average) ? candidate.vote_average : 0;
  const voteCount = Number.isFinite(candidate.vote_count) ? candidate.vote_count : 0;
  if (voteCount >= SCORING_WEIGHTS.minVoteCountForVoteSignal) {
    points += (Math.min(Math.max(voteAverage, 0), 10) / 10) * SCORING_WEIGHTS.voteMax;
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
  /** v3 - genres frequent among the user's dismissed movies. Reduces score
   *  for candidates sharing them; never excludes on its own (only literal
   *  dismissed movie ids exclude - see watchedIds/dismissedIds above). */
  negativeGenreIds?: readonly number[] | null;
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
  const negativeGenreSet = new Set(Array.isArray(context.negativeGenreIds) ? context.negativeGenreIds : []);
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
    .map((candidate) => scoreCandidateMovie(candidate, prefSet, genreMap, negativeGenreSet))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.movie.id - b.movie.id));
}
