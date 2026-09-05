import test from "node:test";
import assert from "node:assert/strict";
import { getMovieTopic, MOVIE_TOPICS, normalizeTopicSlugs } from "./movieTopics";

test("movie topics provide a broad curated set beyond TMDB top-level genres", () => {
  assert.ok(MOVIE_TOPICS.length >= 45);
  assert.equal(new Set(MOVIE_TOPICS.map((topic) => topic.slug)).size, MOVIE_TOPICS.length);
});

test("war searches can reach specific related topics", () => {
  assert.ok(getMovieTopic("world-war-i")?.aliases?.includes("สงครามโลก"));
  assert.ok(getMovieTopic("world-war-ii")?.name.includes("สงครามโลก"));
  assert.ok(getMovieTopic("vietnam-war")?.aliases?.includes("สงคราม"));
});

test("normalizeTopicSlugs accepts only curated topics and de-duplicates them", () => {
  assert.deepEqual(
    normalizeTopicSlugs(["zombie,time-travel", "zombie", "unknown"]),
    ["zombie", "time-travel"],
  );
});

test("getMovieTopic resolves the server-side keyword query", () => {
  assert.equal(getMovieTopic("true-story")?.keywordQuery, "based on true story");
});
