import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStreamingProviderIds } from "./streamingProviders";

test("normalizeStreamingProviderIds parses, de-duplicates, and rejects invalid values", () => {
  assert.deepEqual(
    normalizeStreamingProviderIds(["8,337", "8", "bad", "-1", 9]),
    [8, 337, 9],
  );
});
