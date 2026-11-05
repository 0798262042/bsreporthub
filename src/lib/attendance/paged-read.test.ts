import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readAllPages } from "./paged-read";
test("large attendance reads include every row across pages", async () => {
  const source = Array.from({ length: 1251 }, (_, id) => ({ id }));
  const result = await readAllPages(async (from, to) => ({ data: source.slice(from, to + 1), error: null }));
  assert.equal(result.length, 1251);
  assert.deepEqual(result, source);
});
test("a failed page never returns incomplete attendance as success", async () => {
  await assert.rejects(() => readAllPages(async () => ({ data: null, error: { message: "Unavailable" } })), /Unavailable/);
});