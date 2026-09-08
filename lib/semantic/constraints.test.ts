import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSemanticConstraints,
  evaluateSemanticAttribute,
  getSemanticStorageAttribute,
  normalizeSemanticConstraints,
} from "./constraints";

test("semantic constraints are normalized and unknown values are discarded", () => {
  assert.deepEqual(
    normalizeSemanticConstraints("non_tragic_ending,made_up,non_tragic_ending,plot_twist"),
    ["non_tragic_ending", "plot_twist"],
  );
});

test("non-tragic ending requires an explicit false tragic-ending fact", () => {
  assert.equal(
    evaluateSemanticConstraints(
      ["non_tragic_ending"],
      [{ attribute: "tragic_ending", value: false, confidence: 0.9, source: "test" }],
    ),
    "match",
  );
  assert.equal(
    evaluateSemanticConstraints(
      ["non_tragic_ending"],
      [{ attribute: "tragic_ending", value: true, confidence: 0.9, source: "test" }],
    ),
    "reject",
  );
});

test("low-confidence and missing story facts stay unknown instead of becoming false", () => {
  assert.equal(evaluateSemanticConstraints(["non_tragic_ending"], []), "unknown");
  assert.equal(
    evaluateSemanticConstraints(
      ["non_tragic_ending"],
      [{ attribute: "tragic_ending", value: false, confidence: 0.3, source: "test" }],
    ),
    "unknown",
  );
});

test("a query-specific story fact must explicitly match", () => {
  const attribute = "story_match_deadbeef";
  assert.equal(
    evaluateSemanticAttribute(
      attribute,
      [{ attribute, value: true, confidence: 0.8, source: "test" }],
    ),
    "match",
  );
  assert.equal(
    evaluateSemanticAttribute(
      attribute,
      [{ attribute, value: false, confidence: 0.8, source: "test" }],
    ),
    "reject",
  );
  assert.equal(evaluateSemanticAttribute(attribute, []), "unknown");
});

test("movie and TV facts use different storage attributes even when TMDB IDs collide", () => {
  assert.equal(getSemanticStorageAttribute("movie", "tragic_ending"), "movie:tragic_ending");
  assert.equal(getSemanticStorageAttribute("tv", "tragic_ending"), "tv:tragic_ending");
});

test("shared-cache attributes are tied to the candidate title and year", () => {
  const first = getSemanticStorageAttribute("movie", "tragic_ending", {
    originalTitle: "The Notebook",
    releaseYear: "2004",
  });
  const same = getSemanticStorageAttribute("movie", "tragic_ending", {
    originalTitle: "the notebook",
    releaseYear: "2004",
  });
  const different = getSemanticStorageAttribute("movie", "tragic_ending", {
    originalTitle: "The Notebook",
    releaseYear: "2024",
  });
  assert.equal(first, same);
  assert.notEqual(first, different);
});
