import assert from "node:assert/strict";
import { test } from "./harness";
import { buildCard, type CardContext } from "../src/compose/card";
import { defaultSettings } from "../src/settings/schema";
import { fakeVault } from "./fake-vault";

const v = fakeVault([
  {
    path: "n.md",
    fm: { type: "Organization", date: "2026-08-03", tags: ["firm/vendor", "firm/vendor", "a", "b", "c"] },
    size: 5 * 1024,
  },
  { path: "same.md", fm: { type: "Report", status: "Report" } },
]);
const ctx = (over: Partial<CardContext> = {}): CardContext => ({
  app: v.app,
  settings: defaultSettings(),
  metaKey: "date",
  icons: new Map([["organization", "building"]]),
  ...over,
});

test("a card carries the type verbatim, its icon, and deduped, capped tags", async () => {
  const card = await buildCard(ctx(), v.file("n.md"));
  assert.equal(card.rubric, "Organization");
  assert.equal(card.icon, "building");
  assert.deepEqual(card.tags, ["firm/vendor", "a", "b"]);
  assert.equal(card.dek, null);
});

test("the footer leads with the ranking figure, then the date, then the size", async () => {
  const settings = { ...defaultSettings(), showFileSize: true };
  const card = await buildCard(ctx({ settings }), v.file("n.md"), "7 links");
  const parts = card.meta.split(" · ");
  assert.equal(parts.length, 3);
  assert.equal(parts[0], "7 links");
  assert.match(parts[1], /2026/);
  assert.equal(parts[2], "5 KB");
});

test("a footer value that repeats the type is dropped", async () => {
  const card = await buildCard(ctx({ metaKey: "status" }), v.file("same.md"));
  assert.equal(card.meta, "");
});

test("search covers title, type, tags and a fetched dek", async () => {
  const card = await buildCard(ctx({ deks: async () => "Opening Line" }), v.file("n.md"));
  for (const needle of ["n", "organization", "firm/vendor", "opening line"]) {
    assert.ok(card.search.includes(needle), needle);
  }
});

test("tags off yields none", async () => {
  const settings = { ...defaultSettings(), showTags: false };
  assert.deepEqual((await buildCard(ctx({ settings }), v.file("n.md"))).tags, []);
});
