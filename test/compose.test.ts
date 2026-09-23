import assert from "node:assert/strict";
import { test } from "node:test";
import { composeSections } from "../src/compose/compose";
import { rankSection } from "../src/compose/rank";
import { BLANK_SECTION, defaultSettings, type SectionConfig } from "../src/settings/schema";
import { fakeVault } from "./fake-vault";

const s = defaultSettings();
const section = (over: Partial<SectionConfig>): SectionConfig => ({ ...BLANK_SECTION, id: "t", ...over });

const v = fakeVault(
  [
    { path: "a.md", fm: { type: "Report", date: "2026-03-01" }, tags: ["topic/agents"], ctime: 5, mtime: 50 },
    { path: "b.md", fm: { type: "Report", date: "2026-10-01" }, ctime: 9, mtime: 10 },
    { path: "c.md", fm: { type: "Blog" }, tags: ["topic"], ctime: 1, mtime: 90 },
    { path: "d.md", fm: { type: "Report", date: "" }, ctime: 7, mtime: 70 },
    { path: "e.md", ctime: 3, mtime: 30 },
  ],
  {
    links: { "a.md": { "b.md": 2, "gone.md": 9 }, "c.md": { "b.md": 1, "a.md": 1 }, "e.md": { "c.md": 1 } },
    lastOpen: ["c.md", "missing.md", "a.md"],
  }
);
const paths = (cfg: SectionConfig, settings = s) => rankSection(v.app, cfg, settings).map((r) => r.file.path);

test("recently opened follows the workspace order and skips missing paths", () => {
  assert.deepEqual(paths(section({ kind: "recent-opened" })), ["c.md", "a.md"]);
});

test("recently created and modified order by stat", () => {
  assert.deepEqual(paths(section({ kind: "recent-created" })), ["b.md", "d.md", "a.md", "e.md", "c.md"]);
  assert.deepEqual(paths(section({ kind: "recent-modified" })), ["c.md", "d.md", "a.md", "e.md", "b.md"]);
});

test("property sections admit by key and optional value", () => {
  assert.deepEqual(paths(section({ kind: "property", propertyKey: "type", propertyValue: "blog" })), ["c.md"]);
  assert.deepEqual(paths(section({ kind: "property", propertyKey: "" })), []);
  // `date` is blank on d.md, so d is not admitted by the key alone.
  assert.deepEqual(paths(section({ kind: "property", propertyKey: "date" })), ["b.md", "a.md"]);
});

test("sorting puts blank values last in either direction, falling back to mtime", () => {
  const cfg = section({ kind: "property", propertyKey: "type", propertyValue: "Report", sortKey: "date" });
  assert.deepEqual(paths(cfg), ["b.md", "a.md", "d.md"]);
  assert.deepEqual(paths({ ...cfg, sortDir: "asc" }), ["a.md", "b.md", "d.md"]);
});

test("tag sections match the tag and its descendants", () => {
  assert.deepEqual(paths(section({ kind: "tag", tag: "#topic" })).sort(), ["a.md", "c.md"]);
  assert.deepEqual(paths(section({ kind: "tag", tag: "" })), []);
});

test("popularity counts inbound links once, ignores deleted targets, breaks ties on title", () => {
  const most = rankSection(v.app, section({ kind: "most-linked" }), s);
  assert.deepEqual(
    most.map((r) => [r.file.path, r.lead]),
    [["b.md", "3 links"], ["a.md", "1 link"], ["c.md", "1 link"], ["d.md", "0 links"], ["e.md", "0 links"]]
  );
  assert.deepEqual(paths(section({ kind: "least-linked" })), ["d.md", "e.md", "a.md", "c.md", "b.md"]);
});

test("section filters narrow the pool before ranking", () => {
  assert.deepEqual(paths(section({ kind: "recent-modified", filterProps: "type=Report" })), ["d.md", "a.md", "b.md"]);
});

test("compose honors order, dedupe, the count cap, and disabled sections", async () => {
  const settings = {
    ...s,
    sections: [
      section({ id: "one", kind: "recent-opened", count: 1 }),
      section({ id: "off", kind: "recent-created", enabled: false }),
      section({ id: "two", kind: "recent-modified", count: 3 }),
    ],
  };
  const out = await composeSections(v.app, settings);
  assert.deepEqual(out.map((x) => x.config.id), ["one", "two"]);
  assert.deepEqual(out[0].cards.map((c) => c.file.path), ["c.md"]);
  assert.deepEqual(out[1].cards.map((c) => c.file.path), ["d.md", "a.md", "e.md"]);

  const dupes = await composeSections(v.app, { ...settings, dedupe: false });
  assert.deepEqual(dupes[1].cards.map((c) => c.file.path), ["c.md", "d.md", "a.md"]);
});

test("compose leaves deks null without a source and fills them with one", async () => {
  const settings = { ...s, sections: [section({ kind: "recent-opened", count: 1 })] };
  const lazy = await composeSections(v.app, settings);
  assert.equal(lazy[0].cards[0].dek, null);
  const eager = await composeSections(v.app, settings, async (f) => `dek of ${f.path}`);
  assert.equal(eager[0].cards[0].dek, "dek of c.md");
});
