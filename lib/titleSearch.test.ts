import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTitleSearchFeedApiHref,
  buildTitleSearchHref,
  normalizeTitleSearchMediaType,
  normalizeTitleSearchQuery,
} from "./titleSearch";

test("title query trims and collapses whitespace", () => {
  assert.equal(normalizeTitleSearchQuery("  Spider   Man  "), "Spider Man");
  assert.equal(normalizeTitleSearchQuery(undefined), "");
});

test("movies are the default and TV must be explicitly selected", () => {
  assert.equal(normalizeTitleSearchMediaType("movie"), "movie");
  assert.equal(normalizeTitleSearchMediaType("tv"), "tv");
  assert.equal(normalizeTitleSearchMediaType("anything-else"), "movie");
});

test("search URL preserves Unicode query and explicit media type", () => {
  assert.equal(
    buildTitleSearchHref("เด็กใหม่", "tv"),
    "/search?q=%E0%B9%80%E0%B8%94%E0%B9%87%E0%B8%81%E0%B9%83%E0%B8%AB%E0%B8%A1%E0%B9%88&mediaType=tv",
  );
  assert.equal(buildTitleSearchHref("  ", "tv"), "/search");
});

test("show-more URL keeps query, page, and media type", () => {
  assert.equal(
    buildTitleSearchFeedApiHref(2, "Dune", "movie"),
    "/api/tmdb/feed?page=2&mediaType=movie&query=Dune",
  );
});
