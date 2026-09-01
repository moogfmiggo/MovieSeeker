// Isolated test - see lib/credits.test.ts for why/how (same pattern):
//
//   echo '{"extends":"./tsconfig.json","compilerOptions":{"module":"commonjs","moduleResolution":"node","outDir":"/tmp/timeout-test","noEmit":false},"include":["lib/timeout.ts","lib/timeout.test.ts"]}' > tsconfig.timeout-test.json
//   npx tsc -p tsconfig.timeout-test.json
//   node --test /tmp/timeout-test/lib/timeout.test.js
//   rm tsconfig.timeout-test.json

import test from "node:test";
import assert from "node:assert/strict";
import { withTimeoutFallback } from "./timeout";

test("returns the real value when the promise resolves before the timeout", async () => {
  const result = await withTimeoutFallback(Promise.resolve("real"), 50, "fallback");
  assert.equal(result, "real");
});

test("returns the fallback when the promise doesn't settle before the timeout", async () => {
  const slow = new Promise<string>((resolve) => setTimeout(() => resolve("real"), 100));
  const result = await withTimeoutFallback(slow, 10, "fallback");
  assert.equal(result, "fallback");
});

test("returns the fallback (never throws) when the promise rejects, without waiting for the timeout", async () => {
  const start = Date.now();
  const result = await withTimeoutFallback(Promise.reject(new Error("boom")), 200, "fallback");
  const elapsed = Date.now() - start;
  assert.equal(result, "fallback");
  assert.ok(elapsed < 100, `should resolve promptly on rejection, not wait out the 200ms timeout (took ${elapsed}ms)`);
});

test("a slow-rejecting promise still falls back once the timeout fires, not indefinitely", async () => {
  const slowReject = new Promise<string>((_resolve, reject) => setTimeout(() => reject(new Error("boom")), 100));
  const result = await withTimeoutFallback(slowReject, 10, "fallback");
  assert.equal(result, "fallback");
});

test("works with non-string values (object fallback, e.g. the {} providers map used in production)", async () => {
  const slow = new Promise<Record<number, string>>((resolve) => setTimeout(() => resolve({ 1: "real" }), 100));
  const result = await withTimeoutFallback(slow, 10, {});
  assert.deepEqual(result, {});
});
