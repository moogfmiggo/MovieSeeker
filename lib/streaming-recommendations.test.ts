// Isolated test - see lib/credits.test.ts for why/how (same pattern):
//
//   echo '{"extends":"./tsconfig.json","compilerOptions":{"module":"commonjs","moduleResolution":"node","outDir":"/tmp/streaming-recommendations-test","noEmit":false},"include":["lib/streaming-recommendations.ts","lib/streaming-recommendations.test.ts"]}' > tsconfig.streaming-recommendations-test.json
//   npx tsc -p tsconfig.streaming-recommendations-test.json
//   node --test /tmp/streaming-recommendations-test/lib/streaming-recommendations.test.js
//   rm tsconfig.streaming-recommendations-test.json

import test from "node:test";
import assert from "node:assert/strict";
import {
  computeStreamingRecommendation,
  MIN_INTEREST_SET_SIZE,
  LOW_CONFIDENCE_THRESHOLD,
} from "./streaming-recommendations";
import type { WatchProviderSummary } from "./watchProviders";
import type { TMDBMovie, TMDBWatchProvider } from "../types/tmdb";

function movie(id: number, genreIds: number[] = []): TMDBMovie {
  return {
    id,
    title: `Movie ${id}`,
    overview: "",
    poster_path: null,
    backdrop_path: null,
    release_date: "2020-01-01",
    vote_average: 0,
    vote_count: 0,
    popularity: 0,
    genre_ids: genreIds,
    original_language: "en",
    original_title: `Movie ${id}`,
    adult: false,
    video: false,
  };
}

function provider(id: number, name: string): TMDBWatchProvider {
  return { provider_id: id, provider_name: name, logo_path: null, display_priority: 0 };
}

function streaming(...providers: TMDBWatchProvider[]): WatchProviderSummary {
  return { region: "TH", link: null, streaming: providers, rent: [], buy: [], hasAny: providers.length > 0 };
}

function noProviders(): WatchProviderSummary {
  return { region: "TH", link: null, streaming: [], rent: [], buy: [], hasAny: false };
}

test("empty interest set -> confidence 'empty', no providers", () => {
  const result = computeStreamingRecommendation([], {}, {});
  assert.equal(result.confidence, "empty");
  assert.equal(result.totalInterestSetSize, 0);
  assert.deepEqual(result.providers, []);
});

test("null/undefined inputs never throw", () => {
  assert.equal(computeStreamingRecommendation(null, null, {}).confidence, "empty");
  assert.equal(computeStreamingRecommendation(undefined, undefined, {}).confidence, "empty");
});

test(`fewer than MIN_INTEREST_SET_SIZE (${MIN_INTEREST_SET_SIZE}) movies -> 'insufficient', no ranking shown`, () => {
  const movies = [movie(1), movie(2)];
  const providers = { 1: streaming(provider(8, "Netflix")), 2: streaming(provider(8, "Netflix")) };
  const result = computeStreamingRecommendation(movies, providers, { favoriteIds: [1, 2] });
  assert.equal(result.confidence, "insufficient");
  assert.equal(result.totalInterestSetSize, 2);
  assert.deepEqual(result.providers, []);
});

test("exactly MIN_INTEREST_SET_SIZE movies clears the insufficient bar", () => {
  const movies = Array.from({ length: MIN_INTEREST_SET_SIZE }, (_, i) => movie(i + 1));
  const providers = Object.fromEntries(movies.map((m) => [m.id, streaming(provider(8, "Netflix"))]));
  const result = computeStreamingRecommendation(movies, providers, {
    favoriteIds: movies.map((m) => m.id),
  });
  assert.notEqual(result.confidence, "insufficient");
  assert.notEqual(result.confidence, "empty");
});

test("below LOW_CONFIDENCE_THRESHOLD -> 'low' confidence, but a ranking is still returned", () => {
  const size = Math.max(MIN_INTEREST_SET_SIZE, LOW_CONFIDENCE_THRESHOLD - 1);
  const movies = Array.from({ length: size }, (_, i) => movie(i + 1));
  const providers = Object.fromEntries(movies.map((m) => [m.id, streaming(provider(8, "Netflix"))]));
  const result = computeStreamingRecommendation(movies, providers, {
    favoriteIds: movies.map((m) => m.id),
  });
  assert.equal(result.confidence, "low");
  assert.ok(result.providers.length > 0);
});

test("at/above LOW_CONFIDENCE_THRESHOLD -> 'ready' confidence", () => {
  const movies = Array.from({ length: LOW_CONFIDENCE_THRESHOLD }, (_, i) => movie(i + 1));
  const providers = Object.fromEntries(movies.map((m) => [m.id, streaming(provider(8, "Netflix"))]));
  const result = computeStreamingRecommendation(movies, providers, {
    favoriteIds: movies.map((m) => m.id),
  });
  assert.equal(result.confidence, "ready");
});

test("provider with the highest match count wins (Phase 3's own example: 8 / 3 / 1)", () => {
  const netflixMovies = Array.from({ length: 8 }, (_, i) => movie(i + 1));
  const primeMovies = Array.from({ length: 3 }, (_, i) => movie(i + 100));
  const disneyMovies = [movie(200)];
  const allMovies = [...netflixMovies, ...primeMovies, ...disneyMovies];

  const providersByMovieId: Record<number, WatchProviderSummary> = {};
  for (const m of netflixMovies) providersByMovieId[m.id] = streaming(provider(8, "Netflix"));
  for (const m of primeMovies) providersByMovieId[m.id] = streaming(provider(9, "Prime Video"));
  for (const m of disneyMovies) providersByMovieId[m.id] = streaming(provider(337, "Disney+"));

  const result = computeStreamingRecommendation(allMovies, providersByMovieId, {
    favoriteIds: allMovies.map((m) => m.id),
  });

  assert.equal(result.providers[0].providerName, "Netflix");
  assert.equal(result.providers[0].matchCount, 8);
  assert.equal(result.providers[1].providerName, "Prime Video");
  assert.equal(result.providers[1].matchCount, 3);
  assert.equal(result.providers[2].providerName, "Disney+");
  assert.equal(result.providers[2].matchCount, 1);
});

test("a movie available on multiple providers counts toward each", () => {
  const movies = [movie(1), movie(2), movie(3)];
  const providers = {
    1: streaming(provider(8, "Netflix"), provider(9, "Prime Video")),
    2: streaming(provider(8, "Netflix")),
    3: streaming(provider(9, "Prime Video")),
  };
  const result = computeStreamingRecommendation(movies, providers, { favoriteIds: [1, 2, 3] });
  const netflix = result.providers.find((p) => p.providerName === "Netflix")!;
  const prime = result.providers.find((p) => p.providerName === "Prime Video")!;
  assert.equal(netflix.matchCount, 2);
  assert.equal(prime.matchCount, 2);
});

test("movie with no provider data contributes to interest set size but matches nothing", () => {
  const movies = [movie(1), movie(2), movie(3)];
  const providers = { 1: streaming(provider(8, "Netflix")), 2: noProviders() };
  // movie 3 entirely missing from providersByMovieId
  const result = computeStreamingRecommendation(movies, providers, { favoriteIds: [1, 2, 3] });
  assert.equal(result.totalInterestSetSize, 3);
  assert.equal(result.providers.length, 1);
  assert.equal(result.providers[0].matchCount, 1);
});

test("no user signals -> every movie has zero weight, no providers matched", () => {
  const movies = [movie(1), movie(2), movie(3)];
  const providers = {
    1: streaming(provider(8, "Netflix")),
    2: streaming(provider(8, "Netflix")),
    3: streaming(provider(8, "Netflix")),
  };
  // No favoriteIds/watchedIds at all - defensive path, shouldn't normally happen upstream.
  const result = computeStreamingRecommendation(movies, providers, {});
  assert.equal(result.totalInterestSetSize, 3);
  assert.deepEqual(result.providers, []);
});

test("rent/buy-only availability is ignored - this feature is subscription-only", () => {
  const movies = [movie(1), movie(2), movie(3)];
  const providers: Record<number, WatchProviderSummary> = {
    1: { region: "TH", link: null, streaming: [], rent: [provider(2, "Apple TV")], buy: [], hasAny: true },
    2: { region: "TH", link: null, streaming: [], rent: [], buy: [provider(2, "Apple TV")], hasAny: true },
    3: streaming(provider(8, "Netflix")),
  };
  const result = computeStreamingRecommendation(movies, providers, { favoriteIds: [1, 2, 3] });
  assert.equal(result.providers.length, 1);
  assert.equal(result.providers[0].providerName, "Netflix");
});

test("provider unavailable in Thailand never matches (already reduced to an empty streaming bucket upstream)", () => {
  const movies = [movie(1), movie(2), movie(3)];
  const providers = { 1: noProviders(), 2: noProviders(), 3: streaming(provider(8, "Netflix")) };
  const result = computeStreamingRecommendation(movies, providers, { favoriteIds: [1, 2, 3] });
  assert.equal(result.providers.length, 1);
  assert.equal(result.providers[0].matchCount, 1);
});

test("all interest movies TH-unavailable for streaming -> empty ranking even though confidence isn't 'insufficient'", () => {
  const movies = [movie(1), movie(2), movie(3)];
  const providers = { 1: noProviders(), 2: noProviders(), 3: noProviders() };
  const result = computeStreamingRecommendation(movies, providers, { favoriteIds: [1, 2, 3] });
  assert.notEqual(result.confidence, "insufficient");
  assert.deepEqual(result.providers, []);
});

test("duplicate movie IDs in the interest list are deduped, not double-counted", () => {
  const movies = [movie(1), movie(1), movie(2), movie(3)];
  const providers = {
    1: streaming(provider(8, "Netflix")),
    2: streaming(provider(8, "Netflix")),
    3: streaming(provider(8, "Netflix")),
  };
  const result = computeStreamingRecommendation(movies, providers, { favoriteIds: [1, 2, 3] });
  assert.equal(result.totalInterestSetSize, 3);
  assert.equal(result.providers[0].matchCount, 3);
});

test("a movie that is both favorited and watched counts once, weighted as a favorite", () => {
  const movies = [movie(1), movie(2), movie(3)];
  const providers = {
    1: streaming(provider(8, "Netflix")),
    2: streaming(provider(8, "Netflix")),
    3: streaming(provider(8, "Netflix")),
  };
  const result = computeStreamingRecommendation(movies, providers, {
    favoriteIds: [1],
    watchedIds: [1, 2, 3], // movie 1 is in both
  });
  assert.equal(result.providers[0].matchCount, 3);
  assert.equal(result.providers[0].favoriteMatchCount, 1);
  assert.equal(result.providers[0].watchedOnlyMatchCount, 2);
});

test("favorites outrank an equal match count made only of watched movies", () => {
  const favMovies = [movie(1), movie(2), movie(3)];
  const watchedMovies = [movie(4), movie(5), movie(6)];
  const providers: Record<number, WatchProviderSummary> = {};
  for (const m of favMovies) providers[m.id] = streaming(provider(8, "Netflix"));
  for (const m of watchedMovies) providers[m.id] = streaming(provider(9, "Prime Video"));

  const result = computeStreamingRecommendation([...favMovies, ...watchedMovies], providers, {
    favoriteIds: favMovies.map((m) => m.id),
    watchedIds: watchedMovies.map((m) => m.id),
  });

  // Equal matchCount (3 vs 3), but Netflix's matches are all favorites -> ranked first.
  assert.equal(result.providers[0].providerName, "Netflix");
  assert.equal(result.providers[0].matchCount, 3);
  assert.equal(result.providers[1].providerName, "Prime Video");
});

test("equal weight and equal match count -> deterministic alphabetical tie-break", () => {
  // A third, provider-less movie pads the interest set past MIN_INTEREST_SET_SIZE
  // without affecting either provider's count - keeps Netflix/Prime Video tied.
  const movies = [movie(1), movie(2), movie(3)];
  const providers = {
    1: streaming(provider(9, "Prime Video")),
    2: streaming(provider(8, "Netflix")),
    3: noProviders(),
  };
  const result = computeStreamingRecommendation(movies, providers, { favoriteIds: [1, 2, 3] });
  // Both matchCount=1, both weight=3 (a single favorite each) - alphabetical: Netflix before Prime Video.
  assert.deepEqual(result.providers.map((p) => p.providerName), ["Netflix", "Prime Video"]);
});

test("coveragePercent is matchCount / total interest set size, rounded", () => {
  const movies = [movie(1), movie(2), movie(3), movie(4)];
  const providers = {
    1: streaming(provider(8, "Netflix")),
    2: streaming(provider(8, "Netflix")),
    3: streaming(provider(8, "Netflix")),
    4: noProviders(),
  };
  const result = computeStreamingRecommendation(movies, providers, { favoriteIds: [1, 2, 3, 4] });
  assert.equal(result.providers[0].coveragePercent, 75); // 3 of 4
});

test("preferred genre bonus can break a tie between otherwise-equal providers", () => {
  const movies = [movie(1, [28]), movie(2), movie(3)]; // movie 1 is genre 28, matching the user's preference
  const providers = {
    1: streaming(provider(9, "Prime Video")),
    2: streaming(provider(8, "Netflix")),
    3: noProviders(),
  };
  const result = computeStreamingRecommendation(movies, providers, {
    favoriteIds: [1, 2, 3],
    preferredGenreIds: [28],
  });
  // Both matchCount=1, but Prime's movie also matches a preferred genre -> higher internal weight -> ranked first.
  assert.equal(result.providers[0].providerName, "Prime Video");
});

test("returned ProviderMatch never carries an internal weight/score field", () => {
  const movies = [movie(1), movie(2), movie(3)];
  const providers = {
    1: streaming(provider(8, "Netflix")),
    2: streaming(provider(8, "Netflix")),
    3: streaming(provider(8, "Netflix")),
  };
  const result = computeStreamingRecommendation(movies, providers, { favoriteIds: [1, 2, 3] });
  const keys = Object.keys(result.providers[0]);
  for (const forbidden of ["weight", "totalWeight", "score", "internalWeight"]) {
    assert.ok(!keys.includes(forbidden), `unexpected key "${forbidden}" leaked into ProviderMatch`);
  }
});

test("matchedMovies on a ProviderMatch lists the actual matching movies", () => {
  const movies = [movie(1), movie(2), movie(3)];
  const providers = { 1: streaming(provider(8, "Netflix")), 2: streaming(provider(8, "Netflix")), 3: noProviders() };
  const result = computeStreamingRecommendation(movies, providers, { favoriteIds: [1, 2, 3] });
  assert.deepEqual(
    result.providers[0].matchedMovies.map((m) => m.id).sort((a, b) => a - b),
    [1, 2],
  );
});
