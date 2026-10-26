/**
 * Relate, the optional companion plugin: what Home Cards accepts from it,
 * what each source does with it, and that every source behaves as before
 * without it.
 */

import assert from "node:assert/strict";
import { setImmediate as settled } from "node:timers/promises";
import { test } from "vitest";
import { composePage } from "../src/compose/compose";
import { neighbourCount, noteSections } from "../src/compose/note-page";
import { rankSection } from "../src/compose/rank";
import { relatedToRecent } from "../src/compose/related";
import { asRelateApi, chainText, hitLead, relateView, runSearches, type RelateApi, type RelateHit } from "../src/compose/relate";
import { VaultSnapshot } from "../src/compose/vault";
import { normalizeSettings } from "../src/settings/normalize";
import { refFromState, resolvePage, stateFromRef } from "../src/settings/pages";
import { blankSection, defaultSettings, isGenerated, needsRelate, REDISCOVER_STRATEGIES, SECTION_KINDS, type SectionConfig } from "../src/settings/schema";
import { fakeVault } from "./fake-vault";

/** The sections of a composed page. */
const sectionsOf = async (...args: Parameters<typeof composePage>) => (await composePage(...args)).sections;

const NOW = new Date(2026, 9, 21, 10);
const T = NOW.getTime();

const v = fakeVault(
  [
    { path: "Projects/Q3 Plan.md", mtime: T },
    { path: "Notes/Pricing.md", mtime: T - 1000 },
    { path: "Notes/Churn.md", mtime: T - 2000 },
    { path: "People/Ana.md", mtime: T - 3000 },
    { path: "Notes/Echo.md", mtime: T - 4000 },
    { path: "Notes/Loose.md", mtime: T - 5000 },
    { path: "Index.md", mtime: T - 6000 },
  ],
  {
    links: {
      "Projects/Q3 Plan.md": { "Notes/Pricing.md": 1, "Notes/Churn.md": 1, "Notes/Loose.md": 1 },
      "Notes/Pricing.md": { "Projects/Q3 Plan.md": 1 },
      "Notes/Churn.md": { "Projects/Q3 Plan.md": 1 },
      "Index.md": { "Projects/Q3 Plan.md": 1 },
    },
    lastOpen: ["Projects/Q3 Plan.md"],
  }
);

const hits: RelateHit[] = [
  { path: "Notes/Pricing.md", reasons: ["notes of Q3 Plan"], paths: [] },
  {
    path: "People/Ana.md",
    reasons: ["notes of all parts of Q3 Plan"],
    paths: [
      [
        { from: "People/Ana.md", prop: "member of", to: "Notes/Churn.md" },
        { from: "Notes/Churn.md", prop: "project", to: "Projects/Q3 Plan.md" },
      ],
    ],
  },
  { path: "Gone.md", reasons: ["x"], paths: [] },
];

function fakeRelate(over: Partial<RelateApi> = {}): RelateApi {
  return {
    version: 1,
    search: async () => hits,
    connections: (path) =>
      path === "Projects/Q3 Plan.md"
        ? [
            { prop: "notes", path: "Notes/Pricing.md" },
            { prop: "notes", path: "Notes/Churn.md" },
            { prop: "owner", path: "People/Ana.md" },
          ]
        : [],
    similar: (path) => (path === "Projects/Q3 Plan.md" ? [{ path: "Notes/Echo.md", score: 0.8 }, { path: "Notes/Pricing.md", score: 0.7 }] : []),
    meaningReady: () => true,
    ...over,
  };
}

const settings = defaultSettings();
const section = (over: Partial<SectionConfig>) => blankSection({ id: "s", ...over });

test("only a Relate with a known contract and every method counts", () => {
  assert.ok(asRelateApi(fakeRelate()));
  assert.equal(asRelateApi(null), null);
  assert.equal(asRelateApi({ ...fakeRelate(), version: 2 }), null, "a later contract is not one Home Cards can use");
  assert.equal(asRelateApi({ ...fakeRelate(), similar: undefined }), null);
  assert.equal(asRelateApi("relate"), null);
});

test("sources that need Relate are marked, and note-page sources are never offered", () => {
  assert.deepEqual(SECTION_KINDS.filter(needsRelate).map((k) => k.id), ["relate", "relationship", "similar"]);
  assert.deepEqual(REDISCOVER_STRATEGIES.filter(needsRelate).map((k) => k.id), ["unlinked"]);
  assert.ok(isGenerated("links-out") && isGenerated("similar") && !isGenerated("relate"));
});

test("a Relate search section keeps Relate's order and explains each card", async () => {
  const [composed] = await sectionsOf(v.app, settings, {
    sections: [section({ kind: "relate", query: "notes of all parts of Q3 Plan" })],
    relate: fakeRelate(),
    now: NOW,
  });
  assert.deepEqual(composed.cards.map((c) => c.file.path), ["Notes/Pricing.md", "People/Ana.md"], "a missing note is skipped");
  assert.match(composed.cards[1].meta, /^member of: Churn → project: Q3 Plan/);
  const ana = hits[1];
  assert.equal(hitLead(ana, "notes of all parts of Q3 Plan"), "member of: Churn → project: Q3 Plan");
  assert.equal(hitLead(hits[0], "notes of Q3 Plan"), undefined, "a reason that repeats the query says nothing");
  assert.equal(hitLead({ path: "x", reasons: ["notes of Q3 Plan", "this week"], paths: [] }, "notes of Q3 Plan this week"), undefined);
  assert.equal(hitLead({ path: "x", reasons: ["notes of Q3 Plan", "mentions pricing"], paths: [] }, "notes of Q3 Plan pricing"), "mentions pricing");
  assert.equal(chainText(ana.paths[0]), "member of: Churn → project: Q3 Plan");
});

test("without Relate, a Relate section is empty and the page still composes", async () => {
  const out = await sectionsOf(v.app, settings, {
    sections: [section({ id: "a", kind: "relate", query: "notes of Q3 Plan" }), section({ id: "b", kind: "recent-modified" })],
    now: NOW,
  });
  assert.deepEqual(out[0].cards, []);
  assert.equal(out[1].cards[0].file.path, "Projects/Q3 Plan.md");
});

test("a failing Relate empties its sections and nothing else", async () => {
  const broken = fakeRelate({
    search: async () => {
      throw new Error("boom");
    },
    connections: () => {
      throw new Error("boom");
    },
  });
  const searches = await runSearches(broken, ["x", " x ", ""]);
  assert.deepEqual([...searches], [["x", []]], "each distinct query runs once");
  assert.deepEqual(relateView(broken, searches).connections("Projects/Q3 Plan.md"), []);
});

test("Related to recent work names relationships and closeness in meaning", () => {
  const snap = new VaultSnapshot(v.app, NOW, [], null, undefined, relateView(fakeRelate(), new Map()));
  const ranked = relatedToRecent(snap, snap.files);
  const lead = (p: string) => ranked.find((r) => r.file.path === p)?.lead;
  assert.equal(lead("Notes/Pricing.md"), "Q3 Plan's notes");
  assert.equal(lead("People/Ana.md"), "Q3 Plan's owner");
  assert.equal(lead("Notes/Echo.md"), "Close in meaning to Q3 Plan");
  assert.equal(lead("Notes/Loose.md"), "Linked from Q3 Plan", "a plain link reads as before");

  const plain = new VaultSnapshot(v.app, NOW);
  const without = relatedToRecent(plain, plain.files);
  assert.equal(without.find((r) => r.file.path === "Notes/Pricing.md")?.lead, "Linked from Q3 Plan");
  assert.ok(!without.some((r) => r.file.path === "Notes/Echo.md"), "no meaning without Relate");
});

test("Similar but unlinked passes over linked notes and notes opened lately", () => {
  const visits = new Map([["Notes/Echo.md", { count: 3, last: T - 1000 }]]);
  const cfg = section({ kind: "rediscover", strategy: "unlinked" });
  const run = (visitMap: Map<string, { count: number; last: number }>, relate = relateView(fakeRelate(), new Map())) =>
    rankSection(new VaultSnapshot(v.app, NOW, [], null, { events: () => [], visits: () => visitMap }, relate), cfg, settings).map((r) => [
      r.file.path,
      r.lead,
    ]);
  assert.deepEqual(run(new Map()), [["Notes/Echo.md", "Close in meaning to Q3 Plan, not linked"]], "Pricing is linked, so it is left out");
  assert.deepEqual(run(visits), [], "opened yesterday");
  assert.deepEqual(run(new Map(), relateView(fakeRelate({ meaningReady: () => false }), new Map())), []);
  assert.deepEqual(rankSection(new VaultSnapshot(v.app, NOW), cfg, settings), [], "empty without Relate");
});

test("a note's page shows links and backlinks alone, and relationships first with Relate", async () => {
  const path = "Projects/Q3 Plan.md";
  const alone = noteSections(path, null, new VaultSnapshot(v.app).links());
  assert.deepEqual(alone.map((s) => [s.kind, s.title]), [["links-out", ""], ["links-in", ""]]);
  const composed = await sectionsOf(v.app, settings, { sections: alone, now: NOW });
  assert.deepEqual(composed[0].cards.map((c) => c.file.path), ["Notes/Pricing.md", "Notes/Churn.md", "Notes/Loose.md"]);
  assert.deepEqual(composed[1].cards.map((c) => c.file.path), ["Index.md"], "backlinks not already shown above");

  const relate = fakeRelate();
  const view = relateView(relate, new Map());
  const withRelate = noteSections(path, view, new VaultSnapshot(v.app).links());
  assert.deepEqual(withRelate.map((s) => s.kind === "relationship" ? s.relation : s.kind), ["notes", "owner", "links-out", "links-in", "similar"]);
  assert.equal(withRelate[2].title, "Other links in this note");
  const full = await sectionsOf(v.app, settings, { sections: withRelate, now: NOW, relate });
  const cards = (i: number) => full[i].cards.map((c) => c.file.path);
  assert.deepEqual(cards(0), ["Notes/Pricing.md", "Notes/Churn.md"]);
  assert.deepEqual(cards(1), ["People/Ana.md"]);
  assert.deepEqual(cards(2), ["Notes/Loose.md"], "only the link no relationship covers");
  assert.deepEqual(cards(4), ["Notes/Echo.md"]);
  assert.match(full[4].cards[0].meta, /^Very close in meaning/);
  assert.equal(neighbourCount(path, new VaultSnapshot(v.app).links(), view), 5);
  assert.equal(neighbourCount(path, new VaultSnapshot(v.app).links(), null), 4);
});

test("a note's page is a page reference of its own, and new fields survive a reload", () => {
  const ref = refFromState({ note: "Projects/Q3 Plan.md" });
  assert.deepEqual(ref, { note: "Projects/Q3 Plan.md" });
  assert.deepEqual(stateFromRef(ref), { note: "Projects/Q3 Plan.md" });
  assert.deepEqual(refFromState({ note: "Projects" }), {}, "only a note path");
  const page = resolvePage(settings, ref);
  assert.equal(page?.title, "Q3 Plan");
  assert.equal(page?.key, "note:Projects/Q3 Plan.md");
  assert.equal(page?.note, "Projects/Q3 Plan.md");

  const stored = normalizeSettings({ sections: [{ id: "r", kind: "relate", query: "notes of Q3 Plan" }, { id: "u", kind: "rediscover", strategy: "unlinked" }] });
  assert.equal(stored.sections[0].kind, "relate", "kept when Relate is not installed");
  assert.equal(stored.sections[0].query, "notes of Q3 Plan");
  assert.equal(stored.sections[1].strategy, "unlinked");
});

test("a slow search shows empty for now, and its results wait in the cache", async () => {
  let resolve: (h: RelateHit[]) => void = () => undefined;
  let late = 0;
  const slow = fakeRelate({ search: () => new Promise<RelateHit[]>((r) => (resolve = r)) });
  const cache = new Map<string, RelateHit[]>();
  const sleep = () => Promise.resolve();
  const first = await runSearches(slow, ["q"], { cache, waitMs: 10, onLate: () => late++, sleep });
  assert.deepEqual(first.get("q"), []);
  resolve(hits);
  await settled();
  assert.equal(late, 1, "the page is told to redraw");
  let calls = 0;
  const counted = fakeRelate({ search: async () => (calls++, []) });
  const again = await runSearches(counted, ["q"], { cache });
  assert.equal(again.get("q")?.length, 3, "served from the cache");
  assert.equal(calls, 0);
});

test("a note's page composes from one snapshot and counts the notes it covers", async () => {
  const page = await composePage(v.app, settings, { note: "Projects/Q3 Plan.md", relate: fakeRelate(), now: NOW });
  assert.deepEqual(page.configs.map((c) => c.kind), ["relationship", "relationship", "links-out", "links-in", "similar"]);
  assert.equal(page.notes, 5);
  const plain = await composePage(v.app, settings, { note: "Projects/Q3 Plan.md", now: NOW });
  assert.equal(plain.notes, 4);
});

test("Relate results of the wrong shape keep only their well-formed entries", async () => {
  const odd = {
    connections: () => "not a list",
    similar: () => [{ path: "Notes/Echo.md", score: 0.8 }, { path: 3, score: 1 }, null],
    meaningReady: () => "yes",
  } as unknown as Partial<RelateApi>;
  const view = relateView(fakeRelate(odd), new Map());
  assert.deepEqual(view.connections("Projects/Q3 Plan.md"), []);
  assert.deepEqual(view.similar("Projects/Q3 Plan.md", 4), [{ path: "Notes/Echo.md", score: 0.8 }]);
  assert.equal(view.meaningReady(), false, "only true means ready");

  const hostile = fakeRelate({
    similar: () => [Object.defineProperty({}, "path", { get: () => { throw new Error("boom"); } })] as never,
  });
  assert.deepEqual(relateView(hostile, new Map()).similar("Projects/Q3 Plan.md", 4), []);

  const sloppy = fakeRelate({ search: async () => [{ path: "Notes/Pricing.md" }, { reasons: ["no path"] }] as never });
  const results = await runSearches(sloppy, ["q"]);
  assert.deepEqual(results.get("q"), [{ path: "Notes/Pricing.md", reasons: [], paths: [] }]);
});

test("a Relate search that throws at once comes back empty", async () => {
  const throwing = fakeRelate({
    search: () => {
      throw new Error("not ready");
    },
  });
  const results = await runSearches(throwing, ["notes of Q3 Plan"]);
  assert.deepEqual(results.get("notes of Q3 Plan"), []);
  const [composed] = await sectionsOf(v.app, settings, {
    sections: [section({ kind: "relate", query: "notes of Q3 Plan" })],
    relate: throwing,
    now: NOW,
  });
  assert.deepEqual(composed.cards, []);
});

test("a section that fails empties itself and leaves the rest of the page", async () => {
  const broken = fakeVault([{ path: "A.md", mtime: T }, { path: "B.md", mtime: T - 1 }]);
  Object.defineProperty(broken.app.metadataCache, "resolvedLinks", {
    get: () => {
      throw new Error("index not ready");
    },
  });
  const [linked, modified] = await sectionsOf(broken.app, settings, {
    sections: [section({ kind: "most-linked" }), section({ id: "m", kind: "recent-modified" })],
    now: NOW,
  });
  assert.deepEqual(linked.cards, []);
  assert.deepEqual(modified.cards.map((c) => c.file.path), ["A.md", "B.md"]);
});
