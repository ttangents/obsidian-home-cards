import assert from "node:assert/strict";
import { test } from "node:test";
import { HISTORY_LIMIT, mergeOpened, OpenHistory, type LocalStore } from "../src/compose/open-history";

function memoryStore(initial?: unknown): LocalStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  if (initial !== undefined) data.set("home-cards-opened", initial);
  return {
    data,
    loadLocalStorage: (key: string) => data.get(key) ?? null,
    saveLocalStorage: (key: string, value: unknown) => void data.set(key, value),
  };
}

test("records newest first, once each, and persists", () => {
  const store = memoryStore();
  const h = new OpenHistory(store);
  for (const p of ["a.md", "b.md", "a.md", "c.md"]) h.record(p);
  assert.deepEqual(h.list(), ["c.md", "a.md", "b.md"]);
  assert.deepEqual(new OpenHistory(store).list(), ["c.md", "a.md", "b.md"]);
});

test("caps the list and survives junk in storage", () => {
  const h = new OpenHistory(memoryStore(["x.md", 4, null, "y.md"]));
  assert.deepEqual(h.list(), ["x.md", "y.md"]);
  for (let i = 0; i < HISTORY_LIMIT + 20; i++) h.record(`${i}.md`);
  assert.equal(h.list().length, HISTORY_LIMIT);
  assert.equal(h.list()[0], `${HISTORY_LIMIT + 19}.md`);
  assert.deepEqual(new OpenHistory(memoryStore("nonsense")).list(), []);
});

test("follows renames without duplicating", () => {
  const h = new OpenHistory(memoryStore(["a.md", "b.md", "c.md"]));
  h.rename("b.md", "B.md");
  assert.deepEqual(h.list(), ["a.md", "B.md", "c.md"]);
  h.rename("a.md", "c.md");
  assert.deepEqual(h.list(), ["c.md", "B.md"]);
  h.rename("zzz.md", "q.md");
  assert.deepEqual(h.list(), ["c.md", "B.md"]);
});

test("a failing store never throws", () => {
  const h = new OpenHistory({
    loadLocalStorage: () => {
      throw new Error("blocked");
    },
    saveLocalStorage: () => {
      throw new Error("blocked");
    },
  });
  const quiet = console.error;
  console.error = () => {};
  try {
    h.record("a.md");
    assert.deepEqual(h.list(), ["a.md"]);
  } finally {
    console.error = quiet;
  }
});

test("Obsidian's list leads, the history extends it", () => {
  assert.deepEqual(mergeOpened(["c.md", "a.md"], ["c.md", "a.md", "e.md", "b.md"]), ["c.md", "a.md", "e.md", "b.md"]);
  assert.deepEqual(mergeOpened([], ["e.md"]), ["e.md"]);
});
