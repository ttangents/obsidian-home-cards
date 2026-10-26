import assert from "node:assert/strict";
import { test } from "vitest";
import {
  compileCondition,
  compileConditions,
  describeCondition,
  inferType,
  normalText,
  opsFor,
  statedValue,
  valueType,
} from "../src/compose/conditions";
import { rankSection } from "../src/compose/rank";
import { VaultSnapshot } from "../src/compose/vault";
import { normalizeConditions, normalizeSettings } from "../src/settings/normalize";
import { blankSection, defaultSettings, type Condition, type ConditionOp } from "../src/settings/schema";
import { fakeVault } from "./fake-vault";

/** Saturday 17 October 2026, 14:30 local time. */
const NOW = new Date(2026, 9, 17, 14, 30);
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const cond = (op: ConditionOp, value = "", property = "p"): Condition => ({ property, op, value });
const passes = (c: Condition, v: unknown) => {
  const t = compileCondition(c, NOW);
  assert.ok(t, `${c.op} compiles`);
  return t(v);
};

test("value types are read from the values", () => {
  assert.equal(valueType("active"), "text");
  assert.equal(valueType("2026-10-20"), "date");
  assert.equal(valueType("2026-10-20T09:00"), "date");
  assert.equal(valueType(4), "number");
  assert.equal(valueType(true), "boolean");
  assert.equal(valueType(["a"]), "list");
  assert.equal(valueType(""), null);
  assert.equal(valueType(null), null);
  assert.equal(valueType({ a: 1 }), null);
  assert.equal(inferType(["2026-01-01", "2026-02-02", "soon"]), "date");
  assert.equal(inferType([1, "x"]), "text", "ties go to text");
  assert.equal(inferType([]), "text");
  assert.deepEqual(opsFor("boolean").map((o) => o.id), ["is", "is-not", "exists", "missing"]);
  assert.ok(opsFor("date").some((o) => o.id === "next-days"));
  assert.ok(!opsFor("text").some((o) => o.id === "gt"));
});

test("text compares without case, link brackets, aliases or a tag's #", () => {
  assert.equal(normalText("[[Leslie Joseph|Les]]"), "leslie joseph");
  assert.equal(normalText("[[People/Jane#Role]]"), "people/jane");
  assert.equal(normalText(" #Active "), "active");
  assert.equal(normalText(4), "4");
});

test("is and is not read text, lists, numbers, booleans and dates", () => {
  assert.ok(passes(cond("is", "active"), "Active"));
  assert.ok(passes(cond("is", "jane"), ["Bob", "[[Jane]]"]));
  assert.ok(passes(cond("is", "4"), 4));
  assert.ok(passes(cond("is", "4"), "4"));
  assert.ok(!passes(cond("is", "4"), "4 stars"));
  assert.ok(passes(cond("is", "true"), true));
  assert.ok(passes(cond("is", "2026-10-20"), "2026-10-20T18:00"));
  assert.ok(!passes(cond("is", "active"), undefined));
  assert.ok(passes(cond("is-not", "done"), "active"));
  assert.ok(passes(cond("is-not", "done"), undefined), "a note without the property is not done");
  assert.ok(!passes(cond("is-not", "done"), ["active", "Done"]));
  assert.equal(compileCondition(cond("is", "  "), NOW), null, "is needs a value");
});

test("number comparisons read numbers and numeric text, and skip the rest", () => {
  assert.ok(passes(cond("gte", "4"), 4));
  assert.ok(passes(cond("gte", "4"), "5"));
  assert.ok(!passes(cond("gt", "4"), 4));
  assert.ok(passes(cond("lt", "4"), 3.5));
  assert.ok(passes(cond("lte", "4"), [9, 2]), "a list passes when a member does");
  assert.ok(!passes(cond("gte", "4"), "high"));
  assert.ok(!passes(cond("gte", "4"), undefined));
  assert.equal(compileCondition(cond("gte", "lots"), NOW), null);
});

test("today runs from local midnight to the next", () => {
  assert.ok(passes(cond("today"), "2026-10-17"));
  assert.ok(passes(cond("today"), at(2026, 10, 17, 0, 0)));
  assert.ok(passes(cond("today"), at(2026, 10, 17, 23, 59)));
  assert.ok(!passes(cond("today"), at(2026, 10, 18, 0, 0)));
  assert.ok(!passes(cond("today"), at(2026, 10, 16, 23, 59)));
});

test("before and after today exclude today", () => {
  assert.ok(passes(cond("before-today"), "2026-10-16"));
  assert.ok(!passes(cond("before-today"), "2026-10-17"));
  assert.ok(passes(cond("after-today"), "2026-10-18"));
  assert.ok(!passes(cond("after-today"), "2026-10-17"));
  assert.ok(!passes(cond("before-today"), "not a date"));
});

test("the next and last N days include today and N whole days", () => {
  assert.ok(passes(cond("next-days", "7"), "2026-10-17"));
  assert.ok(passes(cond("next-days", "7"), "2026-10-24"));
  assert.ok(passes(cond("next-days", "7"), at(2026, 10, 24, 23, 59)));
  assert.ok(!passes(cond("next-days", "7"), "2026-10-25"));
  assert.ok(!passes(cond("next-days", "7"), "2026-10-16"));
  assert.ok(passes(cond("next-days", "0"), "2026-10-17"));
  assert.ok(passes(cond("last-days", "3"), "2026-10-14"));
  assert.ok(!passes(cond("last-days", "3"), "2026-10-13"));
  assert.ok(!passes(cond("last-days", "3"), "2026-10-18"));
  assert.equal(compileCondition(cond("next-days", "-1"), NOW), null);
  assert.equal(compileCondition(cond("next-days", "1.5"), NOW), null);
});

test("older than N days means before the start of the day N days ago", () => {
  assert.ok(passes(cond("older-days", "90"), "2026-07-18"));
  assert.ok(!passes(cond("older-days", "90"), "2026-07-19"));
  assert.ok(!passes(cond("older-days", "90"), at(2026, 7, 19, 0, 0)));
});

test("has a value and is empty treat null, blank and [] as empty", () => {
  for (const empty of [undefined, null, "", []]) {
    assert.ok(passes(cond("missing"), empty));
    assert.ok(!passes(cond("exists"), empty));
  }
  assert.ok(passes(cond("exists"), 0));
  assert.ok(passes(cond("exists"), false));
});

const v = fakeVault([
  { path: "due-today.md", fm: { due: "2026-10-17", status: "active", rating: 5 }, mtime: at(2026, 10, 17, 9).getTime() },
  { path: "overdue.md", fm: { Due: "2026-10-10", status: "waiting", rating: 3 }, mtime: at(2026, 6, 1).getTime() },
  { path: "later.md", fm: { due: "2026-11-30", status: "done" }, ctime: at(2026, 10, 15).getTime(), mtime: at(2026, 10, 15).getTime() },
  { path: "bare.md", mtime: at(2025, 1, 1).getTime(), ctime: at(2025, 1, 1).getTime() },
]);
const match = (conditions: Condition[]) => {
  const test = compileConditions(conditions, NOW);
  return v.app.vault
    .getMarkdownFiles()
    .filter((f) => !test || test(f, v.app.metadataCache.getFileCache(f)))
    .map((f) => f.path);
};

test("conditions combine, all of them, over properties and file fields", () => {
  assert.deepEqual(match([cond("today", "", "due")]), ["due-today.md"]);
  assert.deepEqual(match([cond("before-today", "", "due")]), ["overdue.md"], "keys match without regard to case");
  assert.deepEqual(match([cond("is-not", "done", "status"), cond("gte", "4", "rating")]), ["due-today.md"]);
  assert.deepEqual(match([cond("last-days", "7", "file.ctime")]), ["later.md"]);
  assert.deepEqual(match([cond("older-days", "90", "file.mtime")]), ["overdue.md", "bare.md"]);
  assert.deepEqual(match([cond("missing", "", "status")]), ["bare.md"]);
});

test("conditions that test nothing leave the section alone", () => {
  assert.equal(compileConditions([cond("is", "x", ""), cond("gte", "many", "rating")], NOW), null);
  assert.equal(match([cond("is", "x", "  ")]).length, 4);
});

test("a section's conditions narrow its pool before it ranks", () => {
  const settings = defaultSettings();
  const cfg = blankSection({ id: "s", kind: "recent-modified", conditions: [cond("is-not", "done", "status"), cond("exists", "", "due")] });
  const ranked = rankSection(new VaultSnapshot(v.app, NOW), cfg, settings).map((r) => r.file.path);
  assert.deepEqual(ranked, ["due-today.md", "overdue.md"]);
});

test("conditions read back in words, and only an exact value is stated", () => {
  assert.equal(describeCondition(cond("next-days", "7", "due")), "due is in the next 7 days");
  assert.equal(describeCondition(cond("older-days", "90", "file.mtime")), "modified is older than 90 days");
  assert.equal(describeCondition(cond("gte", "4", "rating")), "rating is at least 4");
  assert.equal(describeCondition(cond("missing", "", "status")), "status is empty");
  assert.deepEqual(statedValue(cond("is", " active ", "status")), { key: "status", value: "active" });
  assert.equal(statedValue(cond("gte", "4", "rating")), null);
  assert.equal(statedValue(cond("is", "2026-10-17", "file.ctime")), null);
  assert.equal(statedValue(cond("is", "", "status")), null);
});

test("stored conditions are cleaned and capped, and sections without them get an empty list", () => {
  const conds = normalizeConditions([
    { property: " status ", op: "is", value: "active" },
    { property: "rating", op: "gte", value: 4 },
    { property: "x", op: "nonsense", value: "1" },
    "junk",
    { op: "exists" },
  ]);
  assert.deepEqual(conds, [
    { property: "status", op: "is", value: "active" },
    { property: "rating", op: "gte", value: "4" },
    { property: "", op: "exists", value: "" },
  ]);
  assert.equal(normalizeConditions(Array.from({ length: 20 }, () => ({ property: "a", op: "exists" }))).length, 8);
  const s = normalizeSettings({ sections: [{ id: "a", kind: "recent-created" }] });
  assert.deepEqual(s.sections[0].conditions, []);
  const fresh = [blankSection({ id: "1" }), blankSection({ id: "2" })];
  fresh[0].conditions.push(cond("exists"));
  assert.equal(fresh[1].conditions.length, 0, "fresh sections share no list");
});
