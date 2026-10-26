/**
 * What a page shows: the line in place of its sections, which sections it
 * draws, and what each one does with new and moved notes.
 */

import assert from "node:assert/strict";
import { test } from "vitest";
import type { CardItem } from "../src/compose/card";
import type { ComposedPage } from "../src/compose/compose";
import { pageGone, planPage, type PlanFacts } from "../src/compose/plan";
import { RELATE_INCOMPATIBLE, type RelateView } from "../src/compose/relate";
import { resolvePage } from "../src/settings/pages";
import { blankScope, blankSection, defaultSettings, type NamedPage, type SectionConfig } from "../src/settings/schema";

const NOW = new Date(2026, 9, 26, 10);
const card = (path: string) => ({ file: { path } }) as unknown as CardItem;
const facts = (over: Partial<PlanFacts> = {}): PlanFacts => ({
  noteExists: () => true,
  folderExists: () => true,
  relate: null,
  relateStatus: "absent",
  now: NOW,
  ...over,
});
const composed = (sections: [SectionConfig, string[]][], notes = 10): ComposedPage => ({
  configs: sections.map(([cfg]) => cfg),
  sections: sections.map(([config, paths]) => ({ config, cards: paths.map(card), more: [], claimed: 0 })),
  notes,
});

const settings = defaultSettings();
const home = resolvePage(settings, {})!;
const status = (value: string) => blankSection({ id: value, kind: "property", propertyKey: "status", propertyValue: value });
const folderPage: NamedPage = { id: "page-w", name: "Work", scope: { ...blankScope(), kind: "folder", folder: "Work" }, sections: null, cssClass: "" };

test("a page that is gone says why", () => {
  assert.equal(pageGone(null, facts()), "This page no longer exists.");
  assert.equal(pageGone(resolvePage(settings, { note: "A.md" }), facts({ noteExists: () => false })), "This note no longer exists.");
  assert.equal(pageGone(resolvePage(settings, { folder: "Work" }), facts({ folderExists: () => false })), "This folder no longer exists.");
  assert.equal(pageGone(home, facts()), null);
});

test("the home page keeps its empty sections, and a pinned section shows only with pins", () => {
  const plan = planPage(home, composed([[blankSection({ id: "p", kind: "pinned" }), []], [blankSection({ id: "r" }), []], [blankSection({ id: "m" }), ["A.md"]]]), facts());
  assert.equal(plan.kind, "sections");
  if (plan.kind !== "sections") return;
  assert.deepEqual(plan.sections.map((s) => s.section.config.id), ["r", "m"]);
  assert.equal(plan.sections[0].emptyText, "This section has no matching notes.");
});

test("a scoped page drops its empty sections but keeps one that takes moved cards", () => {
  const page = resolvePage({ ...settings, pages: [folderPage] }, { page: "page-w" })!;
  const plan = planPage(page, composed([[blankSection({ id: "r" }), []], [status("active"), []], [status("waiting"), ["Work/A.md"]]]), facts());
  assert.equal(plan.kind, "sections");
  if (plan.kind !== "sections") return;
  assert.deepEqual(plan.sections.map((s) => s.section.config.id), ["active", "waiting"]);
  const [active, waiting] = plan.sections;
  assert.deepEqual(waiting.moves.map((m) => [m.title, m.change]), [["status: active", "Set status to active"]]);
  assert.equal(active.drop?.hint, "Drop to set status to active");
  assert.deepEqual(active.create?.template, { folder: "Work", tags: [], properties: { status: "active" } });
  assert.equal(active.create?.tooltip, "New note here: set status to active and file in Work");
  assert.ok(active.draggable);
  assert.deepEqual(plan.templateOf("waiting")?.properties, { status: "waiting" });
});

test("empty pages say what would fill them", () => {
  const page = resolvePage({ ...settings, pages: [folderPage] }, { page: "page-w" })!;
  assert.deepEqual(planPage(page, composed([[blankSection({ id: "r" }), []]], 0), facts()), {
    kind: "empty",
    text: "This folder has no notes yet. Cards appear here as you add them.",
  });
  assert.deepEqual(planPage(home, composed([], 5), facts()), { kind: "empty", text: "Turn on a section in Settings → Home Cards to fill this page." });
  assert.deepEqual(planPage(home, composed([[blankSection({ id: "r" }), []]], 0), facts()), { kind: "empty", text: "Cards appear here as you write notes." });
  const note = resolvePage(settings, { note: "A.md" })!;
  assert.deepEqual(planPage(note, composed([], 0), facts()), { kind: "empty", text: "This note has no links or backlinks yet." });
});

test("sections that need Relate say what is missing", () => {
  const search = blankSection({ id: "q", kind: "relate", query: "notes of Q3 Plan" });
  const unlinked = blankSection({ id: "u", kind: "rediscover", strategy: "unlinked" });
  const page = composed([[search, []], [unlinked, []]]);
  const texts = (f: PlanFacts) => {
    const plan = planPage(home, page, f);
    return plan.kind === "sections" ? plan.sections.map((s) => s.emptyText) : [];
  };
  assert.deepEqual(texts(facts()), [
    "This section shows a search from the Relate plugin, which is not running.",
    "This strategy uses search by meaning from the Relate plugin, which is not running.",
  ]);
  assert.deepEqual(texts(facts({ relateStatus: "incompatible" })), [RELATE_INCOMPATIBLE, RELATE_INCOMPATIBLE]);
  const relate: RelateView = { connections: () => [], similar: () => [], meaningReady: () => false, results: () => undefined };
  assert.deepEqual(texts(facts({ relate, relateStatus: "present" })), [
    "Relate found no notes for this search.",
    "Turn on search by meaning in Relate's settings to fill this section.",
  ]);
});
