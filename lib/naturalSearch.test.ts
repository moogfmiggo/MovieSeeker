import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNaturalSearchHref,
  interpretNaturalSearchFallback,
  validateAiSearchIntent,
} from "./naturalSearch";

test("fallback understands a Korean romantic-comedy series request", () => {
  assert.deepEqual(
    interpretNaturalSearchFallback("ซีรี่เกาหลีโรแมนติกคอมเมดี้ที่ตอนจบไม่เศร้า"),
    {
      mediaType: "tv",
      genreIds: [35],
      topicSlugs: ["romantic-comedy"],
      originCountry: "KR",
      semanticConstraints: ["non_tragic_ending"],
    },
  );
});

test("fallback keeps multiple explicit movie genres as an AND search", () => {
  const intent = interpretNaturalSearchFallback("หนังสารคดีเกี่ยวกับสงคราม", "movie");
  assert.equal(intent.mediaType, "movie");
  assert.deepEqual(intent.genreIds, [99, 10752]);
  assert.deepEqual(intent.topicSlugs, []);
});

test("fallback preserves the selected type when the query does not specify one", () => {
  assert.equal(interpretNaturalSearchFallback("แนวสืบสวน", "tv").mediaType, "tv");
});

test("AI validation accepts only known taxonomy values and preserves fallback constraints", () => {
  const fallback = interpretNaturalSearchFallback("ซีรี่เกาหลีคอมเมดี้", "movie");
  assert.deepEqual(
    validateAiSearchIntent(
      {
        mediaType: "tv",
        genreIds: [35, 999999],
        topicSlugs: ["romantic-comedy", "made-up"],
        originCountry: "kr",
        semanticConstraints: [],
      },
      fallback,
    ),
    {
      mediaType: "tv",
      genreIds: [35],
      topicSlugs: [],
      originCountry: "KR",
      semanticConstraints: [],
    },
  );
});

test("AI validation cannot invent a production country", () => {
  const fallback = interpretNaturalSearchFallback("หนังสารคดีเกี่ยวกับสงคราม", "movie");
  const intent = validateAiSearchIntent(
    {
      mediaType: "movie",
      genreIds: [99, 10752],
      topicSlugs: [],
      originCountry: "US",
      semanticConstraints: [],
    },
    fallback,
  );

  assert.equal(intent?.originCountry, undefined);
});

test("natural-search URL records media, origin and fallback without creating a queue", () => {
  const intent = interpretNaturalSearchFallback("ซีรี่เกาหลีคอมเมดี้", "movie");
  assert.equal(
    buildNaturalSearchHref(intent, "ซีรี่เกาหลีคอมเมดี้", "genre-fallback", [8]),
    "/movies?providers=8&seriesGenres=35&media=tv&mode=genre-fallback&q=%E0%B8%8B%E0%B8%B5%E0%B8%A3%E0%B8%B5%E0%B9%88%E0%B9%80%E0%B8%81%E0%B8%B2%E0%B8%AB%E0%B8%A5%E0%B8%B5%E0%B8%84%E0%B8%AD%E0%B8%A1%E0%B9%80%E0%B8%A1%E0%B8%94%E0%B8%B5%E0%B9%89&origin=KR",
  );
});

test("natural-search URL carries story conditions into semantic filtering", () => {
  const intent = interpretNaturalSearchFallback("หนังตลกตอนจบไม่เศร้า", "movie");
  assert.match(
    buildNaturalSearchHref(intent, "หนังตลกตอนจบไม่เศร้า", "genre-fallback"),
    /semantics=non_tragic_ending$/,
  );
});

test("negative story conditions never also select their positive opposite", () => {
  assert.deepEqual(
    interpretNaturalSearchFallback("หนังที่ไม่มีสัตว์ตายและตัวเอกไม่ตาย").semanticConstraints,
    ["no_protagonist_death", "no_animal_death"],
  );
});
