import test from "node:test";
import assert from "node:assert/strict";
import type { TMDBMovie } from "../types/tmdb";
import { sortMoviesByRating } from "./movieRating";

function movie(id: number, rating: number, votes: number): TMDBMovie {
  return {
    id,
    title: String(id),
    overview: "",
    poster_path: null,
    backdrop_path: null,
    release_date: "",
    vote_average: rating,
    vote_count: votes,
    popularity: 1,
    genre_ids: [],
    original_language: "en",
    original_title: String(id),
    adult: false,
    video: false,
  };
}

test("sorts by rating and uses vote count to break equal scores", () => {
  const original = [movie(1, 7.5, 500), movie(2, 9, 10), movie(3, 7.5, 900)];
  assert.deepEqual(sortMoviesByRating(original).map((item) => item.id), [2, 3, 1]);
  assert.deepEqual(original.map((item) => item.id), [1, 2, 3]);
});
