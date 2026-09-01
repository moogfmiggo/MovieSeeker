import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeLocalizedMoviePage,
  mergeLocalizedMovieText,
  moviePageNeedsEnglishFallback,
} from "./tmdbLocalization";
import type { TMDBMovie, TMDBPopularMoviesResponse } from "../types/tmdb";

function movie(id: number, title: string, overview: string, originalTitle = `Original ${id}`): TMDBMovie {
  return {
    id,
    title,
    overview,
    original_title: originalTitle,
    poster_path: null,
    backdrop_path: null,
    release_date: "2026-01-01",
    vote_average: 7,
    vote_count: 100,
    popularity: 50,
    genre_ids: [],
    original_language: "en",
    adult: false,
    video: false,
  };
}

function page(results: TMDBMovie[]): TMDBPopularMoviesResponse {
  return { page: 1, results, total_pages: 4, total_results: 80 };
}

test("keeps Thai title and overview when both are available", () => {
  const result = mergeLocalizedMovieText(
    movie(1, "ชื่อไทย", "เรื่องย่อภาษาไทย"),
    movie(1, "English title", "English overview"),
  );
  assert.equal(result.title, "ชื่อไทย");
  assert.equal(result.overview, "เรื่องย่อภาษาไทย");
});

test("fills only missing Thai fields from English", () => {
  const result = mergeLocalizedMovieText(
    movie(1, "ชื่อไทย", "   "),
    movie(1, "English title", "English overview"),
  );
  assert.equal(result.title, "ชื่อไทย");
  assert.equal(result.overview, "English overview");
});

test("falls back to original title when neither localization has a title", () => {
  const result = mergeLocalizedMovieText(movie(1, "", "", "Original title"));
  assert.equal(result.title, "Original title");
  assert.equal(result.overview, "");
});

test("page merge preserves Thai ordering and pagination metadata", () => {
  const thai = page([movie(2, "ไทย 2", ""), movie(1, "ไทย 1", "เรื่องย่อ")]);
  const english = page([
    movie(1, "English 1", "English overview 1"),
    movie(2, "English 2", "English overview 2"),
  ]);
  const result = mergeLocalizedMoviePage(thai, english);

  assert.deepEqual(result.results.map((item) => item.id), [2, 1]);
  assert.equal(result.results[0].title, "ไทย 2");
  assert.equal(result.results[0].overview, "English overview 2");
  assert.equal(result.total_pages, 4);
});

test("detects when a list needs an English fallback request", () => {
  assert.equal(moviePageNeedsEnglishFallback(page([movie(1, "ชื่อไทย", "เรื่องย่อ")])), false);
  assert.equal(moviePageNeedsEnglishFallback(page([movie(1, "ชื่อไทย", "")])), true);
});
