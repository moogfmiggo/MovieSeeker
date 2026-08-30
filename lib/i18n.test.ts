// Isolated test - see lib/credits.test.ts for why/how (same pattern):
//
//   echo '{"extends":"./tsconfig.json","compilerOptions":{"module":"commonjs","moduleResolution":"node","outDir":"/tmp/i18n-test","noEmit":false},"include":["lib/i18n.ts","lib/i18n.test.ts","lib/recommendations-v2.ts"]}' > tsconfig.i18n-test.json
//   npx tsc -p tsconfig.i18n-test.json
//   node --test /tmp/i18n-test/lib/i18n.test.js
//   rm tsconfig.i18n-test.json
//
// Scope note: this file only covers th.home.strongPattern - the one new
// i18n template with real branching logic added in Phase 4 Task 2. The
// project doesn't unit-test its other (simpler) template strings, so this
// intentionally isn't a full i18n test suite.

import test from "node:test";
import assert from "node:assert/strict";
import { th } from "./i18n";

test("strongPattern: empty input renders nothing, never throws", () => {
  assert.equal(th.home.strongPattern([]), "");
});

test("strongPattern: a single genre name", () => {
  assert.equal(th.home.strongPattern(["Sci-Fi"]), "คุณดูและชอบหนังแนว Sci-Fi หลายเรื่อง");
});

test("strongPattern: two genre names are joined with 'และ' (Part 2's State D example)", () => {
  assert.equal(th.home.strongPattern(["Sci-Fi", "Thriller"]), "คุณดูและชอบหนังแนว Sci-Fi และ Thriller หลายเรื่อง");
});

test("strongPattern: falsy entries are filtered out rather than rendered", () => {
  assert.equal(th.home.strongPattern(["Sci-Fi", "", "Thriller"]), "คุณดูและชอบหนังแนว Sci-Fi และ Thriller หลายเรื่อง");
});
