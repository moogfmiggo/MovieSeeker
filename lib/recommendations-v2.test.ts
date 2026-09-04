// Isolated test - see lib/credits.test.ts for why/how (same pattern):
//
//   echo '{"extends":"./tsconfig.json","compilerOptions":{"module":"commonjs","moduleResolution":"node","outDir":"/tmp/recommendations-v2-test","noEmit":false},"include":["lib/recommendations-v2.ts","lib/recommendations-v2.test.ts"]}' > tsconfig.recommendations-v2-test.json
//   npx tsc -p tsconfig.recommendations-v2-test.json
//   node --test /tmp/recommendations-v2-test/lib/recommendations-v2.test.js
//   rm tsconfig.recommendations-v2-test.json

import test from "node:test";
import assert from "node:assert/strict";
import {
  rankRecommendations,
  determineProfileState,
  mergeCandidatePools,
  attachSignalsToExistingCandidates,
  buildAffinityProfile,
  SCORING_WEIGHTS,
  affinityOccurrenceCount,
  MIN_RICH_NEGATIVE_OCCURRENCES,
  type CandidateMovie,
  type MatchedSignal,
} from "./recommendations-v2";
import type { TMDBMovie } from "../types/tmdb";

function movie(overrides: Partial<TMDBMovie> = {}): TMDBMovie {
  return {
    id: 1,
    title: "Test Movie",
    overview: "",
    poster_path: null,
    backdrop_path: null,
    release_date: "2020-01-01",
    vote_average: 7,
    vote_count: 100,
    popularity: 50,
    genre_ids: [],
    original_language: "en",
    original_title: "Test Movie",
    adult: false,
    video: false,
    ...overrides,
  };
}

function candidate(overrides: Partial<TMDBMovie> & { matchedSignals?: MatchedSignal[] } = {}): CandidateMovie {
  const { matchedSignals, ...movieOverrides } = overrides;
  return { ...movie(movieOverrides), matchedSignals: matchedSignals ?? [] };
}

// --- 1. Genre preference ranking ---

test("genre preference: movies matching more preferred genres rank higher", () => {
  const scifi = candidate({ id: 1, genre_ids: [878], popularity: 0, vote_count: 0 });
  const scifiAction = candidate({ id: 2, genre_ids: [878, 28], popularity: 0, vote_count: 0 });
  const unrelated = candidate({ id: 3, genre_ids: [35], popularity: 0, vote_count: 0 });
  const ranked = rankRecommendations([unrelated, scifi, scifiAction], { preferredGenreIds: [878, 28] });
  assert.deepEqual(ranked.map((r) => r.movie.id), [2, 1, 3]);
});

test("genre preference matching is capped - a 3rd+ matching genre adds no further points beyond the cap", () => {
  const twoMatches = candidate({ id: 1, genre_ids: [1, 2], popularity: 0, vote_count: 0 });
  const threeMatches = candidate({ id: 2, genre_ids: [1, 2, 3], popularity: 0, vote_count: 0 });
  const ranked = rankRecommendations([twoMatches, threeMatches], { preferredGenreIds: [1, 2, 3] });
  const scoreById = Object.fromEntries(ranked.map((r) => [r.movie.id, r.score]));
  assert.equal(scoreById[1], scoreById[2]);
});

// --- 2. Favorite signal stronger than watched ---

test("a favorite-derived signal outranks a plain candidate; watched ids present in context never inflate any score", () => {
  const favoriteMatch = candidate({
    id: 1,
    popularity: 0,
    vote_count: 0,
    matchedSignals: [{ type: "directorAffinity", personId: 9, personName: "Dir" }],
  });
  const plain = candidate({ id: 2, popularity: 0, vote_count: 0 });
  const ranked = rankRecommendations([favoriteMatch, plain], { watchedIds: [50, 51, 52] });
  assert.equal(ranked[0].movie.id, 1);
  assert.ok(ranked[0].score > ranked[1].score);
});

// --- 3. Watched movies excluded ---

test("watched movies are excluded entirely, even if they'd otherwise score highly", () => {
  const stronglyMatching = candidate({
    id: 5,
    matchedSignals: [{ type: "favoriteSimilarity", favoriteMovieId: 1, favoriteTitle: "X" }],
  });
  const ranked = rankRecommendations([stronglyMatching], { watchedIds: [5] });
  assert.deepEqual(ranked, []);
});

// --- 4. Dismissed movies excluded ---

test("dismissed movies are excluded entirely", () => {
  const c = candidate({ id: 7 });
  const ranked = rankRecommendations([c], { dismissedIds: [7] });
  assert.deepEqual(ranked, []);
});

test("watched and dismissed exclusion compose - both lists apply at once", () => {
  const a = candidate({ id: 1 });
  const b = candidate({ id: 2 });
  const c = candidate({ id: 3 });
  const ranked = rankRecommendations([a, b, c], { watchedIds: [1], dismissedIds: [2] });
  assert.deepEqual(ranked.map((r) => r.movie.id), [3]);
});

// --- 5. Favorite movie similarity ---

test("favoriteSimilarity signal produces a favoriteSimilarity reason and awards points", () => {
  const c = candidate({
    id: 10,
    popularity: 0,
    vote_count: 0,
    matchedSignals: [{ type: "favoriteSimilarity", favoriteMovieId: 99, favoriteTitle: "Inception" }],
  });
  const [result] = rankRecommendations([c]);
  assert.equal(result.primaryReason.type, "favoriteSimilarity");
  assert.ok(result.reasons.some((r) => r.type === "favoriteSimilarity" && r.favoriteTitle === "Inception"));
  assert.ok(result.score > 0);
});

// --- 6. Director affinity ---

test("directorAffinity signal produces a directorAffinity reason", () => {
  const c = candidate({
    id: 11,
    matchedSignals: [{ type: "directorAffinity", personId: 5, personName: "Denis Villeneuve" }],
  });
  const [result] = rankRecommendations([c]);
  assert.ok(result.reasons.some((r) => r.type === "directorAffinity" && r.personName === "Denis Villeneuve"));
});

// --- 7. Actor affinity ---

test("actorAffinity signal produces an actorAffinity reason", () => {
  const c = candidate({
    id: 12,
    matchedSignals: [{ type: "actorAffinity", personId: 6, personName: "Zendaya" }],
  });
  const [result] = rankRecommendations([c]);
  assert.ok(result.reasons.some((r) => r.type === "actorAffinity" && r.personName === "Zendaya"));
});

// --- 8. Production company affinity ---

test("companyAffinity signal produces a companyAffinity reason", () => {
  const c = candidate({
    id: 13,
    matchedSignals: [{ type: "companyAffinity", companyId: 7, companyName: "A24" }],
  });
  const [result] = rankRecommendations([c]);
  assert.ok(result.reasons.some((r) => r.type === "companyAffinity" && r.companyName === "A24"));
});

test("director/actor/company affinity all score higher than a plain candidate, in the documented priority order", () => {
  const director = candidate({ id: 1, popularity: 0, vote_count: 0, matchedSignals: [{ type: "directorAffinity", personId: 1, personName: "D" }] });
  const actor = candidate({ id: 2, popularity: 0, vote_count: 0, matchedSignals: [{ type: "actorAffinity", personId: 2, personName: "A" }] });
  const company = candidate({ id: 3, popularity: 0, vote_count: 0, matchedSignals: [{ type: "companyAffinity", companyId: 3, companyName: "C" }] });
  const plain = candidate({ id: 4, popularity: 0, vote_count: 0 });
  const ranked = rankRecommendations([plain, company, actor, director]);
  assert.deepEqual(ranked.map((r) => r.movie.id), [1, 2, 3, 4]);
});

// --- v3 Part 1: keyword/theme affinity ("movie characteristics") ---

test("keywordAffinity signal produces a keywordAffinity reason and awards points", () => {
  const c = candidate({
    id: 14,
    popularity: 0,
    vote_count: 0,
    matchedSignals: [{ type: "keywordAffinity", keywordId: 9882, keywordName: "time travel" }],
  });
  const [result] = rankRecommendations([c]);
  assert.ok(result.reasons.some((r) => r.type === "keywordAffinity" && r.keywordName === "time travel"));
  assert.ok(result.score > 0);
});

// --- v3 Part 1: genre is now a secondary signal, not primary ---

test("v3 rebalance: a keyword/director/similarity-matched candidate outranks a genre-only match with the same number of matched genres", () => {
  const genreOnly = candidate({ id: 1, genre_ids: [1, 2], popularity: 0, vote_count: 0 });
  const keywordMatched = candidate({ id: 2, popularity: 0, vote_count: 0, matchedSignals: [{ type: "keywordAffinity", keywordId: 1, keywordName: "K" }] });
  const ranked = rankRecommendations([genreOnly, keywordMatched], { preferredGenreIds: [1, 2] });
  const scoreById = Object.fromEntries(ranked.map((r) => [r.movie.id, r.score]));
  assert.ok(scoreById[2] > scoreById[1], "keyword affinity should outscore a genre-only match");
});

test("v3 rebalance: company affinity (the weakest favorite-derived signal) still outscores a single genre match", () => {
  const genreOnly = candidate({ id: 1, genre_ids: [1], popularity: 0, vote_count: 0 });
  const companyMatched = candidate({ id: 2, popularity: 0, vote_count: 0, matchedSignals: [{ type: "companyAffinity", companyId: 1, companyName: "C" }] });
  const ranked = rankRecommendations([genreOnly, companyMatched], { preferredGenreIds: [1] });
  const scoreById = Object.fromEntries(ranked.map((r) => [r.movie.id, r.score]));
  assert.ok(scoreById[2] > scoreById[1]);
});

// --- v3 Part 1/6: negative preference (dismissed-derived) reduces ranking ---

test("negativeGenreIds reduces the score of a candidate matching a dismissed-derived genre", () => {
  // Both share a baseline positive signal so the penalty is visible above
  // the "score never goes below 0" floor, rather than both landing on 0.
  const negativeMatch = candidate({
    id: 1,
    genre_ids: [27], // horror - matches the negative signal
    popularity: 0,
    vote_count: 0,
    matchedSignals: [{ type: "companyAffinity", companyId: 1, companyName: "C" }],
  });
  const neutral = candidate({
    id: 2,
    genre_ids: [99], // documentary - no overlap with the negative signal either way
    popularity: 0,
    vote_count: 0,
    matchedSignals: [{ type: "companyAffinity", companyId: 1, companyName: "C" }],
  });
  const ranked = rankRecommendations([negativeMatch, neutral], { negativeGenreIds: [27] });
  const scoreById = Object.fromEntries(ranked.map((r) => [r.movie.id, r.score]));
  assert.ok(scoreById[1] < scoreById[2]);
});

test("negative genre affinity never drops a score below 0, and never adds a MatchReason (penalties aren't explained, only positive matches are)", () => {
  const c = candidate({ id: 1, genre_ids: [27], popularity: 0, vote_count: 0 });
  const [result] = rankRecommendations([c], { negativeGenreIds: [27] });
  assert.ok(result.score >= 0);
  assert.ok(!result.reasons.some((r) => JSON.stringify(r).toLowerCase().includes("negative")));
  assert.equal(result.primaryReason.type, "popular"); // no positive signal at all here
});

test("a strong positive signal still outranks a candidate carrying a negative-genre match", () => {
  const negativeButFavorited = candidate({
    id: 1,
    genre_ids: [27],
    popularity: 0,
    vote_count: 0,
    matchedSignals: [{ type: "favoriteSimilarity", favoriteMovieId: 1, favoriteTitle: "X" }],
  });
  const neutral = candidate({ id: 2, popularity: 0, vote_count: 0 });
  const ranked = rankRecommendations([negativeButFavorited, neutral], { negativeGenreIds: [27] });
  assert.equal(ranked[0].movie.id, 1); // -10 penalty doesn't erase a +30 similarity match
});

test("negative genre matching is capped, same as positive genre matching", () => {
  const twoMatches = candidate({ id: 1, genre_ids: [1, 2], popularity: 0, vote_count: 0 });
  const threeMatches = candidate({ id: 2, genre_ids: [1, 2, 3], popularity: 0, vote_count: 0 });
  const ranked = rankRecommendations([twoMatches, threeMatches], { negativeGenreIds: [1, 2, 3] });
  const scoreById = Object.fromEntries(ranked.map((r) => [r.movie.id, r.score]));
  assert.equal(scoreById[1], scoreById[2]);
});

test("rich negative affinities lower matching candidates without adding a UI reason", () => {
  const signals: MatchedSignal[] = [
    { type: "negativeDirectorAffinity", personId: 1, personName: "D" },
    { type: "negativeActorAffinity", personId: 2, personName: "A" },
    { type: "negativeCompanyAffinity", companyId: 3, companyName: "C" },
    { type: "negativeKeywordAffinity", keywordId: 4, keywordName: "K" },
  ];
  for (const signal of signals) {
    const matched = candidate({
      id: 1,
      popularity: 0,
      vote_count: 0,
      matchedSignals: [
        { type: "favoriteSimilarity", favoriteMovieId: 9, favoriteTitle: "Liked" },
        signal,
      ],
    });
    const neutral = candidate({
      id: 2,
      popularity: 0,
      vote_count: 0,
      matchedSignals: [{ type: "favoriteSimilarity", favoriteMovieId: 9, favoriteTitle: "Liked" }],
    });
    const ranked = rankRecommendations([matched, neutral]);
    const scoreById = Object.fromEntries(ranked.map((result) => [result.movie.id, result.score]));
    assert.ok(scoreById[1] < scoreById[2], `${signal.type} should reduce score`);
    assert.ok(!ranked.find((result) => result.movie.id === 1)?.reasons.some(
      (reason) => JSON.stringify(reason).toLowerCase().includes("negative"),
    ));
  }
});

test("negative pools annotate existing candidates but never introduce negative-only movies", () => {
  const existing = candidate({ id: 1, matchedSignals: [{ type: "discoverPool" }] });
  const result = attachSignalsToExistingCandidates(
    [existing],
    [{
      movies: [movie({ id: 1 }), movie({ id: 2 })],
      signal: { type: "negativeKeywordAffinity", keywordId: 10, keywordName: "slasher" },
    }],
  );

  assert.deepEqual(result.map((item) => item.id), [1]);
  assert.ok(result[0].matchedSignals.some((signal) => signal.type === "negativeKeywordAffinity"));
  assert.equal(existing.matchedSignals.length, 1, "input candidate must not be mutated");
});

test("duplicate negative pool signals are attached and scored only once", () => {
  const existing = candidate({
    id: 1,
    popularity: 0,
    vote_count: 0,
    matchedSignals: [{ type: "favoriteSimilarity", favoriteMovieId: 9, favoriteTitle: "Liked" }],
  });
  const signal: MatchedSignal = {
    type: "negativeDirectorAffinity",
    personId: 7,
    personName: "D",
  };
  const once = attachSignalsToExistingCandidates([existing], [{ movies: [movie({ id: 1 })], signal }]);
  const twice = attachSignalsToExistingCandidates(
    [existing],
    [{ movies: [movie({ id: 1 })], signal }, { movies: [movie({ id: 1 })], signal }],
  );
  assert.equal(rankRecommendations(once)[0].score, rankRecommendations(twice)[0].score);
});

test("rich negative affinity requires the same trait in at least two dismissed movies", () => {
  const sources = [
    { genreIds: [], directors: [{ id: 7, name: "D" }], topCast: [], companies: [], keywords: [] },
    { genreIds: [], directors: [{ id: 7, name: "D" }], topCast: [], companies: [], keywords: [] },
    { genreIds: [], directors: [{ id: 8, name: "Other" }], topCast: [], companies: [], keywords: [] },
  ];
  assert.equal(affinityOccurrenceCount(sources, "director", 7), MIN_RICH_NEGATIVE_OCCURRENCES);
  assert.equal(affinityOccurrenceCount(sources.slice(0, 1), "director", 7), 1);
  assert.equal(affinityOccurrenceCount(sources, "actor", 7), 0);
});

// --- v3 Part 1: centralized, configurable scoring weights ---

test("SCORING_WEIGHTS is centralized (one exported config), not scattered magic numbers", () => {
  for (const key of [
    "genreMatch",
    "favoriteGenre",
    "favoriteSimilarity",
    "directorAffinity",
    "actorAffinity",
    "companyAffinity",
    "keywordAffinity",
    "popularityMax",
    "voteMax",
    "negativeGenre",
    "negativeDirectorAffinity",
    "negativeActorAffinity",
    "negativeCompanyAffinity",
    "negativeKeywordAffinity",
  ] as const) {
    assert.equal(typeof SCORING_WEIGHTS[key], "number", `SCORING_WEIGHTS.${key} should be a configured number`);
  }
  assert.ok(SCORING_WEIGHTS.negativeGenre < 0, "negative weight must actually be negative");
  assert.ok(SCORING_WEIGHTS.negativeDirectorAffinity < 0);
  assert.ok(SCORING_WEIGHTS.negativeActorAffinity < 0);
  assert.ok(SCORING_WEIGHTS.negativeCompanyAffinity < 0);
  assert.ok(SCORING_WEIGHTS.negativeKeywordAffinity < 0);
  assert.ok(SCORING_WEIGHTS.genreMatch < SCORING_WEIGHTS.keywordAffinity, "genre must be weighted below the new primary signals (v3 Part 1)");
  assert.ok(SCORING_WEIGHTS.genreMatch < SCORING_WEIGHTS.directorAffinity);
  assert.ok(SCORING_WEIGHTS.genreMatch < SCORING_WEIGHTS.favoriteSimilarity);
});

// --- 9. Popularity as secondary signal ---

test("popularity/vote_average never override a real match - a niche matched movie outranks a hugely popular unrelated one", () => {
  const veryPopularButUnrelated = candidate({ id: 1, popularity: 5000, vote_average: 9, vote_count: 20000, genre_ids: [] });
  const nicheButMatched = candidate({
    id: 2,
    popularity: 5,
    vote_average: 5,
    vote_count: 10,
    matchedSignals: [{ type: "directorAffinity", personId: 1, personName: "X" }],
  });
  const ranked = rankRecommendations([veryPopularButUnrelated, nicheButMatched]);
  assert.equal(ranked[0].movie.id, 2);
});

test("vote_average is ignored below the minimum vote_count threshold (avoids noisy low-count high-average movies)", () => {
  const noisyHighAverage = candidate({ id: 1, vote_average: 10, vote_count: 1, popularity: 0 });
  const zeroVotes = candidate({ id: 2, vote_average: 0, vote_count: 0, popularity: 0 });
  const ranked = rankRecommendations([noisyHighAverage, zeroVotes]);
  const scoreById = Object.fromEntries(ranked.map((r) => [r.movie.id, r.score]));
  assert.equal(scoreById[1], scoreById[2]);
});

// --- 10. Deterministic ranking ---

test("ranking is deterministic: equal scores tie-break by movie id ascending, repeated calls produce identical output", () => {
  const a = candidate({ id: 20 });
  const b = candidate({ id: 10 });
  const first = rankRecommendations([a, b]);
  const second = rankRecommendations([a, b]);
  assert.deepEqual(first.map((r) => r.movie.id), [10, 20]);
  assert.deepEqual(first, second);
});

test("rankRecommendations never mutates its candidates input", () => {
  const c = candidate({ id: 1, matchedSignals: [{ type: "directorAffinity", personId: 1, personName: "X" }] });
  const snapshot = JSON.parse(JSON.stringify(c));
  rankRecommendations([c], { preferredGenreIds: [1] });
  assert.deepEqual(c, snapshot);
});

// --- 11/12/13. Profile states (empty / preferences-only / strong, plus someInteraction) ---

test("determineProfileState: no signals at all -> 'new'", () => {
  assert.equal(determineProfileState({}), "new");
  assert.equal(determineProfileState({ preferredGenreIds: [], favoriteIds: [], watchedIds: [] }), "new");
});

test("determineProfileState: preferences only -> 'preferencesOnly'", () => {
  assert.equal(determineProfileState({ preferredGenreIds: [28] }), "preferencesOnly");
});

test("determineProfileState: any favorite or watched interaction (below the strong threshold) -> 'someInteraction'", () => {
  assert.equal(determineProfileState({ favoriteIds: [1] }), "someInteraction");
  assert.equal(determineProfileState({ watchedIds: [1, 2, 3] }), "someInteraction");
  assert.equal(determineProfileState({ preferredGenreIds: [1], favoriteIds: [1] }), "someInteraction");
});

test("determineProfileState: 5+ favorites -> 'strong', regardless of watched count", () => {
  assert.equal(determineProfileState({ favoriteIds: [1, 2, 3, 4, 5] }), "strong");
  assert.equal(determineProfileState({ favoriteIds: [1, 2, 3, 4, 5], watchedIds: [] }), "strong");
});

// --- 14. No candidate movies ---

test("no candidates -> empty result, never throws", () => {
  assert.deepEqual(rankRecommendations([]), []);
  assert.deepEqual(rankRecommendations(null), []);
  assert.deepEqual(rankRecommendations(undefined), []);
});

// --- 15. Duplicate candidates ---

test("duplicate candidate ids passed into rankRecommendations are merged, not duplicated in output", () => {
  const a = candidate({ id: 1, matchedSignals: [{ type: "directorAffinity", personId: 1, personName: "A" }] });
  const aAgain = candidate({ id: 1, matchedSignals: [{ type: "actorAffinity", personId: 2, personName: "B" }] });
  const ranked = rankRecommendations([a, aAgain]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].reasons.length, 2);
});

test("mergeCandidatePools: the same movie from two pools is deduped by id and keeps both signals", () => {
  const m = movie({ id: 1 });
  const merged = mergeCandidatePools([
    { movies: [m], signal: { type: "directorAffinity", personId: 1, personName: "A" } },
    { movies: [m], signal: { type: "actorAffinity", personId: 2, personName: "B" } },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].matchedSignals.length, 2);
});

test("mergeCandidatePools: null/empty/malformed pools never throw", () => {
  assert.deepEqual(mergeCandidatePools(null), []);
  assert.deepEqual(mergeCandidatePools([]), []);
  assert.deepEqual(
    mergeCandidatePools([{ movies: null, signal: { type: "discoverPool" } }]),
    [],
  );
});

// --- 16. Missing optional TMDB data ---

test("missing/malformed optional candidate fields never throw", () => {
  const messy = { id: 1, title: "X", matchedSignals: [] } as unknown as CandidateMovie;
  assert.doesNotThrow(() => rankRecommendations([messy]));
  const [result] = rankRecommendations([messy]);
  assert.ok(Number.isInteger(result.score));
});

test("a candidate with no matched signals and no genre overlap still gets a 'popular' fallback reason (never an empty reasons list)", () => {
  const c = candidate({ id: 1, genre_ids: [999], popularity: 0, vote_count: 0 });
  const [result] = rankRecommendations([c], { preferredGenreIds: [1, 2, 3] });
  assert.equal(result.primaryReason.type, "popular");
  assert.equal(result.reasons.length, 1);
});

// --- Score shape / no leaked internal weights (mirrors streaming-recommendations.ts's own guarantee) ---

test("score is always an integer clamped 0-100, and ScoredMovie never carries raw per-signal point values", () => {
  const c = candidate({
    id: 1,
    popularity: 100000,
    vote_average: 10,
    vote_count: 100000,
    genre_ids: [1, 2],
    matchedSignals: [
      { type: "favoriteSimilarity", favoriteMovieId: 1, favoriteTitle: "A" },
      { type: "directorAffinity", personId: 1, personName: "B" },
      { type: "actorAffinity", personId: 2, personName: "C" },
      { type: "companyAffinity", companyId: 3, companyName: "D" },
    ],
  });
  const [result] = rankRecommendations([c], { preferredGenreIds: [1, 2] });
  assert.ok(Number.isInteger(result.score));
  assert.ok(result.score <= 100 && result.score >= 0);
  assert.deepEqual(Object.keys(result).sort(), ["movie", "primaryReason", "reasons", "score"]);
});

// --- buildAffinityProfile ---

test("buildAffinityProfile: empty/missing sources never throw, return nulls/empty", () => {
  const empty = { topGenreIds: [], topKeywords: [], topDirector: null, topActor: null, topCompany: null };
  assert.deepEqual(buildAffinityProfile([]), empty);
  assert.deepEqual(buildAffinityProfile(null), empty);
});

test("buildAffinityProfile: ranks by frequency, deterministic id-ascending tie-break", () => {
  const sources = [
    { genreIds: [1, 2], directors: [{ id: 10, name: "A" }], topCast: [], companies: [] },
    { genreIds: [2], directors: [{ id: 10, name: "A" }], topCast: [], companies: [] },
    { genreIds: [1], directors: [{ id: 11, name: "B" }], topCast: [], companies: [] },
  ];
  const profile = buildAffinityProfile(sources);
  assert.deepEqual(profile.topGenreIds, [1, 2]); // both appear twice -> tie -> genre id ascending
  assert.deepEqual(profile.topDirector, { id: 10, name: "A" }); // A: 2 occurrences, B: 1
});

test("buildAffinityProfile: never invents an affinity that isn't actually present in the sources", () => {
  const profile = buildAffinityProfile([{ genreIds: [1], directors: [], topCast: [], companies: [] }]);
  assert.equal(profile.topDirector, null);
  assert.equal(profile.topActor, null);
  assert.equal(profile.topCompany, null);
  assert.deepEqual(profile.topKeywords, []);
});

// --- v3: keyword/theme affinity (Discovery v3 Part 1) ---

test("buildAffinityProfile: ranks keywords by frequency with names, same tie-break as directors/actors/companies", () => {
  const sources = [
    { genreIds: [], directors: [], topCast: [], companies: [], keywords: [{ id: 100, name: "time travel" }] },
    { genreIds: [], directors: [], topCast: [], companies: [], keywords: [{ id: 100, name: "time travel" }, { id: 200, name: "space" }] },
  ];
  const profile = buildAffinityProfile(sources);
  assert.deepEqual(profile.topKeywords, [
    { id: 100, name: "time travel" },
    { id: 200, name: "space" },
  ]);
});
