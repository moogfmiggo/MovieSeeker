import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMovieFeedApiHref,
  buildMovieSearchHref,
  buildMoviesHref,
  filterMoviesByAllGenres,
  mergeMoviesById,
  movieMatchesAllGenres,
  normalizeMoviePage,
  normalizeGenreIds,
  serializeDiscoverGenres,
} from "./movieSearch";

test("normalizeGenreIds parses URL values, removes invalid IDs, and de-duplicates", () => {
  assert.deepEqual(normalizeGenreIds(["10752,99", "99", "bad", "-1"]), [10752, 99]);
});

test("buildMoviesHref carries explicit genre search intent to the server page", () => {
  assert.equal(buildMoviesHref([10752, 99]), "/movies?genres=10752,99");
  assert.equal(buildMoviesHref([]), "/movies");
});

test("buildMovieSearchHref carries official genres and curated topics", () => {
  assert.equal(
    buildMovieSearchHref([878], ["time-travel", "space"]),
    "/movies?genres=878&topics=time-travel,space",
  );
});

test("buildMovieFeedApiHref keeps page and AND-search genres in the request", () => {
  assert.equal(
    buildMovieFeedApiHref(2, [10752, 99], ["true-story"]),
    "/api/tmdb/feed?page=2&genres=10752%2C99&topics=true-story",
  );
});

test("normalizeMoviePage rejects invalid values and caps TMDB pages", () => {
  assert.equal(normalizeMoviePage("2"), 2);
  assert.equal(normalizeMoviePage("bad"), 1);
  assert.equal(normalizeMoviePage(0), 1);
  assert.equal(normalizeMoviePage(999), 500);
});

test("mergeMoviesById appends only unseen movies in response order", () => {
  assert.deepEqual(
    mergeMoviesById([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }, { id: 3 }, { id: 4 }]),
    [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
  );
});

test("serializeDiscoverGenres uses comma for all/AND and pipe for any/OR", () => {
  assert.equal(serializeDiscoverGenres([10752, 99], "all"), "10752,99");
  assert.equal(serializeDiscoverGenres([10752, 99], "any"), "10752|99");
});

test("movieMatchesAllGenres requires the complete selected-genre subset", () => {
  assert.equal(movieMatchesAllGenres({ genre_ids: [99, 10752, 36] }, [10752, 99]), true);
  assert.equal(movieMatchesAllGenres({ genre_ids: [10752, 18] }, [10752, 99]), false);
  assert.equal(movieMatchesAllGenres({ genre_ids: [99] }, [10752, 99]), false);
});

test("filterMoviesByAllGenres excludes single-genre matches from a multi-genre search", () => {
  const movies = [
    { id: 1, genre_ids: [99, 10752] },
    { id: 2, genre_ids: [10752] },
    { id: 3, genre_ids: [99] },
    { id: 4, genre_ids: [99, 10752, 36] },
  ];

  assert.deepEqual(
    filterMoviesByAllGenres(movies, [10752, 99]).map((movie) => movie.id),
    [1, 4],
  );
});

test("an empty genre selection preserves the fallback movie pool", () => {
  const movies = [
    { id: 1, genre_ids: [99] },
    { id: 2, genre_ids: [28] },
  ];
  assert.deepEqual(filterMoviesByAllGenres(movies, []), movies);
});
