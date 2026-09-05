import test from "node:test";
import assert from "node:assert/strict";
import { prioritizeStreamingCandidates } from "./homeDiscovery";

test("prioritizeStreamingCandidates puts Thailand streaming titles first", () => {
  const ranked = [
    { movie: { id: 1, vote_average: 9, vote_count: 100 }, score: 95 },
    { movie: { id: 2, vote_average: 7, vote_count: 100 }, score: 90 },
    { movie: { id: 3, vote_average: 8, vote_count: 100 }, score: 85 },
    { movie: { id: 4, vote_average: 8, vote_count: 100 }, score: 80 },
  ];

  assert.deepEqual(
    prioritizeStreamingCandidates(ranked, [2, 4]).map((item) => item.movie.id),
    [4, 2, 1, 3],
  );
});

test("prioritizeStreamingCandidates sorts by rating within both groups", () => {
  const ranked = [
    { movie: { id: 7, vote_average: 7, vote_count: 300 }, score: 91 },
    { movie: { id: 8, vote_average: 9, vote_count: 100 }, score: 87 },
    { movie: { id: 9, vote_average: 8, vote_count: 200 }, score: 82 },
  ];

  assert.deepEqual(
    prioritizeStreamingCandidates(ranked, [9, 7]).map((item) => item.movie.id),
    [9, 7, 8],
  );
});
