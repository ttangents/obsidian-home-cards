import assert from "node:assert/strict";
import { test } from "./harness";
import { cssClassList, MAX_CSS_CLASSES, normalizeCssClass } from "../src/settings/css-classes";
import { normalizeSettings } from "../src/settings/normalize";

test("a CSS class field keeps valid names, in order, without repeats", () => {
  assert.deepEqual(cssClassList("reading-room featured"), ["reading-room", "featured"]);
  assert.deepEqual(cssClassList(" a,b  , a "), ["a", "b"]);
  assert.deepEqual(cssClassList("_x -y"), ["_x", "-y"]);
});

test("a CSS class field takes names and nothing else", () => {
  // Selectors, declarations and markup are not class names.
  assert.deepEqual(cssClassList(".x"), []);
  assert.deepEqual(cssClassList("a{color:red}"), []);
  assert.deepEqual(cssClassList('"><script>'), []);
  assert.deepEqual(cssClassList("1st --x"), []);
  assert.deepEqual(cssClassList("x".repeat(41)), []);
  assert.deepEqual(cssClassList("x".repeat(40)), ["x".repeat(40)]);
});

test("names Home Cards and Obsidian use for themselves are refused", () => {
  assert.deepEqual(cssClassList("hc-card HC-grid home-cards is-hidden mod-active theme-dark mine"), ["mine"]);
  // A name that merely contains a reserved word is fine.
  assert.deepEqual(cssClassList("my-hc-page"), ["my-hc-page"]);
});

test(`a CSS class field holds at most ${MAX_CSS_CLASSES} names`, () => {
  assert.deepEqual(cssClassList("a b c d e"), ["a", "b", "c"]);
  // Invalid names do not count against the limit.
  assert.deepEqual(cssClassList("hc-x a .y b c d"), ["a", "b", "c"]);
});

test("stored classes are normalized, and anything else reads as none", () => {
  assert.equal(normalizeCssClass("  a,,b "), "a b");
  assert.equal(normalizeCssClass(42), "");
  assert.equal(normalizeCssClass(undefined), "");
});

test("pages and sections keep their classes through the normalizer", () => {
  const s = normalizeSettings({
    sections: [{ id: "s1", kind: "pinned", cssClass: "featured hc-bad" }],
    pages: [{ id: "page-r", name: "Reading", scope: { kind: "all" }, cssClass: "reading-room", sections: [{ id: "p1", kind: "tag", tag: "x", cssClass: 7 }] }],
  });
  assert.equal(s.sections.find((c) => c.id === "s1")?.cssClass, "featured");
  assert.equal(s.pages[0].cssClass, "reading-room");
  assert.equal(s.pages[0].sections?.[0].cssClass, "");
  // Settings from before the field read as no classes.
  const old = normalizeSettings({ pages: [{ id: "page-o", name: "Old", scope: { kind: "all" } }] });
  assert.equal(old.pages[0].cssClass, "");
  assert.ok(old.sections.every((c) => c.cssClass === ""));
});
