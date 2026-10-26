import assert from "node:assert/strict";
import { test } from "vitest";
import { foldKey, foldPage, pruneFolds } from "../src/compose/folds";

test("a fold key names its section and, off the home page, its page", () => {
  assert.equal(foldKey("recent", { isHome: true, key: "home" }), "recent");
  assert.equal(foldKey("recent", { isHome: false, key: "note:A/B.md" }), "recent@note:A/B.md");
  assert.equal(foldPage("recent"), "home");
  assert.equal(foldPage("links-in@note:A@B.md"), "note:A@B.md");
  assert.equal(foldPage("note-rel-mail@work@page:page-a"), "page:page-a");
});

test("pruning drops keys of pages that are gone and keeps the newest", () => {
  const keys = ["recent", "links-in@note:Gone.md", "links-in@note:Here.md", "s1@page:page-a", "s1@folder:Old"];
  const exists = (page: string) => page === "note:Here.md" || page === "page:page-a";
  assert.deepEqual(pruneFolds(keys, exists), ["recent", "links-in@note:Here.md", "s1@page:page-a"]);
  const many = Array.from({ length: 8 }, (_, i) => `s@note:${i}.md`);
  assert.deepEqual(pruneFolds(many, () => true, 3), ["s@note:5.md", "s@note:6.md", "s@note:7.md"]);
});
