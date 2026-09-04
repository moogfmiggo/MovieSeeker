import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  loadFavorites,
  loadFavoriteSeries,
  saveFavorites,
  toggleFavoriteSeries,
} from "./favorites";
import {
  loadWatched,
  loadWatchedSeries,
  saveWatched,
  toggleWatchedSeries,
} from "./watched";

const values = new Map<string, string>();
const localStorage = {
  get length() { return values.size; },
  clear() { values.clear(); },
  getItem(key: string) { return values.get(key) ?? null; },
  key(index: number) { return [...values.keys()][index] ?? null; },
  removeItem(key: string) { values.delete(key); },
  setItem(key: string, value: string) { values.set(key, value); },
};

Object.defineProperty(globalThis, "window", {
  value: { localStorage },
  configurable: true,
});

beforeEach(() => localStorage.clear());

test("legacy movie favorites remain readable after adding series favorites", () => {
  localStorage.setItem("movie-recommendation:favorites", JSON.stringify({ movieIds: [12] }));

  assert.deepEqual(toggleFavoriteSeries(12), [12]);
  assert.deepEqual(loadFavorites(), [12]);
  assert.deepEqual(loadFavoriteSeries(), [12]);
});

test("movie and series watched IDs stay separate even when TMDB IDs collide", () => {
  assert.equal(saveWatched([44]), true);
  assert.deepEqual(toggleWatchedSeries(44), [44]);

  assert.deepEqual(loadWatched(), [44]);
  assert.deepEqual(loadWatchedSeries(), [44]);
  assert.deepEqual(toggleWatchedSeries(44), []);
  assert.deepEqual(loadWatched(), [44]);
});

test("saving movies preserves series and normalizes invalid duplicate IDs", () => {
  toggleFavoriteSeries(9);
  assert.equal(saveFavorites([3, 3, -1, Number.NaN]), true);

  assert.deepEqual(loadFavorites(), [3]);
  assert.deepEqual(loadFavoriteSeries(), [9]);
});

test("corrupted library data safely falls back to empty lists", () => {
  localStorage.setItem("movie-recommendation:watched", "not-json");
  assert.deepEqual(loadWatched(), []);
  assert.deepEqual(loadWatchedSeries(), []);
});
