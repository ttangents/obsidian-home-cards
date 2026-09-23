import assert from "node:assert/strict";
import { test } from "node:test";
import { DekCache } from "../src/compose/dek-cache";
import { defaultSettings } from "../src/settings/schema";
import { fakeVault } from "./fake-vault";

const s = defaultSettings();
const notes = () =>
  fakeVault([
    { path: "a.md", body: "The first sentence of note a." },
    { path: "b.md", body: "The first sentence of note b." },
    { path: "c.md", body: "The first sentence of note c." },
  ]);

test("an unchanged file is read once, even when asked for concurrently", async () => {
  const v = notes();
  const cache = new DekCache();
  const [x, y] = await Promise.all([cache.get(v.app, v.file("a.md"), s), cache.get(v.app, v.file("a.md"), s)]);
  await cache.get(v.app, v.file("a.md"), s);
  assert.equal(x, "The first sentence of note a.");
  assert.equal(y, x);
  assert.equal(v.reads.get("a.md"), 1);
});

test("an edit (new mtime) re-reads", async () => {
  const v = notes();
  const cache = new DekCache();
  await cache.get(v.app, v.file("a.md"), s);
  v.edit("a.md", "A rewritten opening sentence.");
  assert.equal(await cache.get(v.app, v.file("a.md"), s), "A rewritten opening sentence.");
  assert.equal(v.reads.get("a.md"), 2);
});

test("changing extraction settings invalidates; unrelated settings do not", async () => {
  const v = notes();
  const cache = new DekCache();
  await cache.get(v.app, v.file("a.md"), s);
  await cache.get(v.app, v.file("a.md"), { ...s, cardMinWidth: 300 });
  assert.equal(v.reads.get("a.md"), 1);
  await cache.get(v.app, v.file("a.md"), { ...s, boilerplateOpeners: "the first" });
  assert.equal(v.reads.get("a.md"), 2);
});

test("capacity evicts the least recently used entry", async () => {
  const v = notes();
  const cache = new DekCache(2);
  await cache.get(v.app, v.file("a.md"), s);
  await cache.get(v.app, v.file("b.md"), s);
  await cache.get(v.app, v.file("a.md"), s); // a is now most recent
  await cache.get(v.app, v.file("c.md"), s); // evicts b
  await cache.get(v.app, v.file("a.md"), s);
  await cache.get(v.app, v.file("b.md"), s);
  assert.equal(v.reads.get("a.md"), 1);
  assert.equal(v.reads.get("b.md"), 2);
});

test("a failed read resolves to an empty dek and is not retried until an edit", async () => {
  const v = notes();
  v.app.vault.cachedRead = async () => {
    throw new Error("EIO");
  };
  const cache = new DekCache();
  assert.equal(await cache.get(v.app, v.file("a.md"), s), "");
  assert.equal(await cache.get(v.app, v.file("a.md"), s), "");
});
