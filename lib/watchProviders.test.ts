// Isolated test - see lib/credits.test.ts for why/how (same pattern):
//
//   echo '{"extends":"./tsconfig.json","compilerOptions":{"module":"commonjs","moduleResolution":"node","outDir":"/tmp/watchproviders-test","noEmit":false},"include":["lib/watchProviders.ts","lib/watchProviders.test.ts"]}' > tsconfig.watchproviders-test.json
//   npx tsc -p tsconfig.watchproviders-test.json
//   node --test /tmp/watchproviders-test/lib/watchProviders.test.js
//   rm tsconfig.watchproviders-test.json

import test from "node:test";
import assert from "node:assert/strict";
import { summarizeWatchProviders, summarizeWatchProvidersByMovie, topProvidersForCard } from "./watchProviders";
import type { TMDBWatchProvider, TMDBWatchProvidersResponse } from "../types/tmdb";

function provider(id: number, name: string, priority = 0, logo: string | null = `/${name}.jpg`): TMDBWatchProvider {
  return { provider_id: id, provider_name: name, logo_path: logo, display_priority: priority };
}

function response(results: TMDBWatchProvidersResponse["results"]): TMDBWatchProvidersResponse {
  return { id: 1, results };
}

test("summarizeWatchProviders: movie with no providers at all", () => {
  const summary = summarizeWatchProviders(response({}));
  assert.equal(summary.hasAny, false);
  assert.deepEqual(summary.streaming, []);
  assert.deepEqual(summary.rent, []);
  assert.deepEqual(summary.buy, []);
});

test("summarizeWatchProviders: null/undefined input never throws", () => {
  assert.equal(summarizeWatchProviders(null).hasAny, false);
  assert.equal(summarizeWatchProviders(undefined).hasAny, false);
});

test("summarizeWatchProviders: region filtering - only requested region's data is used", () => {
  const summary = summarizeWatchProviders(
    response({
      US: { flatrate: [provider(1, "Netflix")] },
      TH: { flatrate: [provider(2, "Netflix TH")] },
    }),
    "TH",
  );
  assert.deepEqual(summary.streaming.map((p) => p.provider_id), [2]);
});

test("summarizeWatchProviders: region present in response but movie has no offers there", () => {
  const summary = summarizeWatchProviders(response({ TH: {} }), "TH");
  assert.equal(summary.hasAny, false);
});

test("summarizeWatchProviders: single streaming provider", () => {
  const summary = summarizeWatchProviders(response({ TH: { flatrate: [provider(1, "Netflix")] } }), "TH");
  assert.equal(summary.hasAny, true);
  assert.deepEqual(summary.streaming.map((p) => p.provider_name), ["Netflix"]);
});

test("summarizeWatchProviders: many streaming providers, sorted by display_priority", () => {
  const summary = summarizeWatchProviders(
    response({
      TH: {
        flatrate: [provider(1, "Disney+", 3), provider(2, "Netflix", 1), provider(3, "Prime Video", 2)],
      },
    }),
    "TH",
  );
  assert.deepEqual(summary.streaming.map((p) => p.provider_name), ["Netflix", "Prime Video", "Disney+"]);
});

test("summarizeWatchProviders: streaming merges flatrate/free/ads and dedupes by provider id", () => {
  const summary = summarizeWatchProviders(
    response({
      TH: {
        flatrate: [provider(1, "Netflix", 0)],
        free: [provider(1, "Netflix", 0), provider(2, "Viu", 1)], // id 1 repeated on purpose
        ads: [provider(3, "Freeform", 2)],
      },
    }),
    "TH",
  );
  assert.deepEqual(summary.streaming.map((p) => p.provider_id), [1, 2, 3]);
});

test("summarizeWatchProviders: rent-only movie", () => {
  const summary = summarizeWatchProviders(response({ TH: { rent: [provider(1, "Apple TV")] } }), "TH");
  assert.equal(summary.hasAny, true);
  assert.deepEqual(summary.streaming, []);
  assert.deepEqual(summary.rent.map((p) => p.provider_name), ["Apple TV"]);
  assert.deepEqual(summary.buy, []);
});

test("summarizeWatchProviders: buy-only movie", () => {
  const summary = summarizeWatchProviders(response({ TH: { buy: [provider(1, "Apple TV")] } }), "TH");
  assert.equal(summary.hasAny, true);
  assert.deepEqual(summary.rent, []);
  assert.deepEqual(summary.buy.map((p) => p.provider_name), ["Apple TV"]);
});

test("summarizeWatchProviders: streaming + rent + buy together stay in separate buckets", () => {
  const summary = summarizeWatchProviders(
    response({
      TH: {
        flatrate: [provider(1, "Netflix")],
        rent: [provider(2, "Apple TV")],
        buy: [provider(2, "Apple TV")], // same provider can both rent and buy
      },
    }),
    "TH",
  );
  assert.deepEqual(summary.streaming.map((p) => p.provider_id), [1]);
  assert.deepEqual(summary.rent.map((p) => p.provider_id), [2]);
  assert.deepEqual(summary.buy.map((p) => p.provider_id), [2]);
});

test("summarizeWatchProviders: missing provider logo is preserved as null, not dropped", () => {
  const summary = summarizeWatchProviders(
    response({ TH: { flatrate: [provider(1, "Mystery Co", 0, null)] } }),
    "TH",
  );
  assert.equal(summary.streaming[0].logo_path, null);
});

test("summarizeWatchProviders: carries the TMDB attribution link when present", () => {
  const summary = summarizeWatchProviders(
    response({ TH: { link: "https://www.themoviedb.org/movie/1/watch", flatrate: [provider(1, "Netflix")] } }),
    "TH",
  );
  assert.equal(summary.link, "https://www.themoviedb.org/movie/1/watch");
});

test("summarizeWatchProvidersByMovie: shapes a batch keyed by movie id", () => {
  const batch = summarizeWatchProvidersByMovie(
    {
      10: response({ TH: { flatrate: [provider(1, "Netflix")] } }),
      20: response({ TH: {} }),
    },
    "TH",
  );
  assert.equal(batch[10].hasAny, true);
  assert.equal(batch[20].hasAny, false);
});

test("topProvidersForCard: prefers streaming, caps to limit, reports overflow count", () => {
  const summary = summarizeWatchProviders(
    response({
      TH: {
        flatrate: [provider(1, "A", 0), provider(2, "B", 1), provider(3, "C", 2), provider(4, "D", 3)],
      },
    }),
    "TH",
  );
  const { visible, moreCount } = topProvidersForCard(summary, 3);
  assert.deepEqual(visible.map((p) => p.provider_name), ["A", "B", "C"]);
  assert.equal(moreCount, 1);
});

test("topProvidersForCard: falls back to rent, then buy, only when streaming is empty", () => {
  const rentOnly = summarizeWatchProviders(response({ TH: { rent: [provider(1, "Apple TV")] } }), "TH");
  assert.deepEqual(topProvidersForCard(rentOnly).visible.map((p) => p.provider_name), ["Apple TV"]);

  const buyOnly = summarizeWatchProviders(response({ TH: { buy: [provider(1, "Apple TV")] } }), "TH");
  assert.deepEqual(topProvidersForCard(buyOnly).visible.map((p) => p.provider_name), ["Apple TV"]);
});

test("topProvidersForCard: no providers at all -> empty, zero overflow", () => {
  const empty = summarizeWatchProviders(response({}));
  const { visible, moreCount } = topProvidersForCard(empty);
  assert.deepEqual(visible, []);
  assert.equal(moreCount, 0);
});
