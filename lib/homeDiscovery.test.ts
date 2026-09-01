import test from "node:test";
import assert from "node:assert/strict";
import { prioritizeStreamingCandidates } from "./homeDiscovery";

test("prioritizeStreamingCandidates puts Thailand streaming titles first", () => {
  const ranked = [
    { movie: { id: 1 }, score: 95 },
    { movie: { id: 2 }, score: 90 },
    { movie: { id: 3 }, score: 85 },
    { movie: { id: 4 }, score: 80 },
  ];

  assert.deepEqual(
    prioritizeStreamingCandidates(ranked, [2, 4]).map((item) => item.movie.id),
    [2, 4, 1, 3],
  );
});

test("prioritizeStreamingCandidates preserves ranking within both groups", () => {
  const ranked = [
    { movie: { id: 7 }, score: 91 },
    { movie: { id: 8 }, score: 87 },
    { movie: { id: 9 }, score: 82 },
  ];

  assert.deepEqual(
    prioritizeStreamingCandidates(ranked, [9, 7]).map((item) => item.movie.id),
    [7, 9, 8],
  );
});
