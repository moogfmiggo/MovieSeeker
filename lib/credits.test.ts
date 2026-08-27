// Isolated test - no test framework dependency, just Node's built-in
// node:test + node:assert. This file's own imports are relative (not "@/"),
// but credits.ts itself imports types via "@/types/tmdb", so a plain `tsc
// --module commonjs` on these two files alone can't resolve that alias - it
// needs the project's tsconfig (for "paths") with module/outDir overridden
// to emit runnable CommonJS instead of Next's bundler-resolved ESNext:
//
//   echo '{"extends":"./tsconfig.json","compilerOptions":{"module":"commonjs","moduleResolution":"node","outDir":"/tmp/credits-test","noEmit":false},"include":["lib/credits.ts","lib/credits.test.ts"]}' > tsconfig.credits-test.json
//   npx tsc -p tsconfig.credits-test.json
//   node --test /tmp/credits-test/lib/credits.test.js
//   rm tsconfig.credits-test.json

import test from "node:test";
import assert from "node:assert/strict";
import { topBilledCast, movieDirectors, filterDirectingCredits, mergeFilmography } from "./credits";
import type {
  TMDBCastMember,
  TMDBCrewMember,
  TMDBPersonMovieCastCredit,
  TMDBPersonMovieCrewCredit,
} from "../types/tmdb";

function baseMovieFields(id: number, releaseDate: string) {
  return {
    id,
    title: `Movie ${id}`,
    overview: "",
    poster_path: null,
    backdrop_path: null,
    release_date: releaseDate,
    vote_average: 0,
    vote_count: 0,
    popularity: 0,
    genre_ids: [] as number[],
    original_language: "en",
    original_title: `Movie ${id}`,
    adult: false,
    video: false,
  };
}

function castCredit(id: number, releaseDate: string): TMDBPersonMovieCastCredit {
  return { ...baseMovieFields(id, releaseDate), character: "Someone", credit_id: `cast-${id}` };
}

function crewCredit(id: number, releaseDate: string, job: string): TMDBPersonMovieCrewCredit {
  return { ...baseMovieFields(id, releaseDate), job, department: "Directing", credit_id: `crew-${id}-${job}` };
}

test("topBilledCast sorts by billing order and respects the limit", () => {
  const cast: TMDBCastMember[] = [
    { id: 3, name: "Third", character: "C", profile_path: null, order: 2 },
    { id: 1, name: "First", character: "A", profile_path: null, order: 0 },
    { id: 2, name: "Second", character: "B", profile_path: null, order: 1 },
  ];
  assert.deepEqual(topBilledCast(cast, 2).map((c) => c.id), [1, 2]);
});

test("topBilledCast handles missing/invalid input", () => {
  assert.deepEqual(topBilledCast(null), []);
  assert.deepEqual(topBilledCast(undefined), []);
});

test("movieDirectors keeps only Director-job crew", () => {
  const crew: TMDBCrewMember[] = [
    { id: 1, name: "A", job: "Director", department: "Directing", profile_path: null },
    { id: 2, name: "B", job: "Producer", department: "Production", profile_path: null },
  ];
  assert.deepEqual(movieDirectors(crew).map((c) => c.id), [1]);
});

test("filterDirectingCredits keeps only Director-job credits", () => {
  const crew = [crewCredit(1, "2020-01-01", "Director"), crewCredit(2, "2021-01-01", "Writer")];
  assert.deepEqual(filterDirectingCredits(crew).map((c) => c.id), [1]);
});

test("mergeFilmography dedupes (cast wins ties) and sorts by release date descending", () => {
  const cast = [castCredit(1, "2019-01-01"), castCredit(2, "2022-01-01")];
  const directing = [crewCredit(2, "2022-01-01", "Director"), crewCredit(3, "2020-06-01", "Director")];
  const result = mergeFilmography(cast, directing);
  assert.deepEqual(result.map((m) => m.id), [2, 3, 1]);
  assert.equal(result.length, 3); // movie 2 appears once despite being both cast and directing
});

test("mergeFilmography sorts undated movies last and handles empty/missing input", () => {
  const cast = [castCredit(1, ""), castCredit(2, "2020-01-01")];
  assert.deepEqual(mergeFilmography(cast, null).map((m) => m.id), [2, 1]);
  assert.deepEqual(mergeFilmography(null, undefined), []);
});
