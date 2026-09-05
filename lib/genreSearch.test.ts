import test from "node:test";
import assert from "node:assert/strict";
import {
  getMovieGenreSearchTerms,
  getSeriesGenreSearchTerms,
  matchesGenreSearch,
  normalizeGenreSearchText,
} from "./genreSearch";

test("normalizes whitespace and keyword separators", () => {
  assert.equal(normalizeGenreSearchText("  TIME-travel / Sci_Fi  "), "time travel sci fi");
  assert.equal(normalizeGenreSearchText(undefined), "");
});

test("matches partial Thai genre names", () => {
  assert.equal(matchesGenreSearch("สาร", ["สารคดี", "documentary"]), true);
  assert.equal(matchesGenreSearch("สงคราม", ["สารคดี", "documentary"]), false);
});

test("supports English aliases for movie and series genres", () => {
  assert.equal(matchesGenreSearch("documentary", ["สารคดี", ...getMovieGenreSearchTerms(99)]), true);
  assert.equal(
    matchesGenreSearch("politics", ["สงครามและการเมือง", ...getSeriesGenreSearchTerms(10768)]),
    true,
  );
});

test("requires every word in a multi-word query to match", () => {
  assert.equal(matchesGenreSearch("time travel", ["เดินทางข้ามเวลา", "time travel"]), true);
  assert.equal(matchesGenreSearch("time horror", ["เดินทางข้ามเวลา", "time travel"]), false);
});

test("matches related Thai phrases through names and synonyms", () => {
  assert.equal(matchesGenreSearch("สงคราม", ["สงครามโลกครั้งที่ 2"]), true);
  assert.equal(matchesGenreSearch("สงครามโลก", ["ทหารและกองทัพ", "สงครามโลก"]), true);
  assert.equal(matchesGenreSearch("รัก", ["โรแมนซ์", ...getMovieGenreSearchTerms(10749)]), true);
});
