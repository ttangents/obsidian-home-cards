import assert from "node:assert/strict";
import { test } from "./harness";
import {
  acceptsMoves,
  describeTemplate,
  hasFacts,
  literalTag,
  mergeTemplates,
  sectionWrite,
  templateForScope,
  typedValue,
} from "../src/compose/templates";
import { blankScope, blankSection, type Condition, type PageScope } from "../src/settings/schema";

const scope = (over: Partial<PageScope>): PageScope => ({ ...blankScope(), ...over });

test("a page's scope gives new notes the facts that put them on the page", () => {
  assert.deepEqual(templateForScope(scope({ kind: "folder", folder: "Work" })), { folder: "Work", tags: [], properties: {} });
  assert.deepEqual(templateForScope(scope({ kind: "tag", tag: "#ideas/new" })).tags, ["ideas/new"]);
  assert.deepEqual(templateForScope(scope({ kind: "property", propertyKey: "type", propertyValue: "Project" })).properties, { type: "Project" });
  assert.deepEqual(templateForScope(scope({ kind: "property", propertyKey: "rating", propertyValue: "4" })).properties, { rating: 4 });
});

test("a scope that names no single value gives no facts", () => {
  for (const s of [
    scope({ kind: "tag", tag: "a,b" }),
    scope({ kind: "tag", tag: "ideas/*" }),
    scope({ kind: "tag" }),
    scope({ kind: "property", propertyKey: "type" }),
    scope({ kind: "property", propertyKey: "bad:key", propertyValue: "x" }),
    blankScope(),
  ]) {
    assert.ok(!hasFacts(templateForScope(s)));
  }
  assert.equal(literalTag("#a b"), null);
});

test("typed values follow what a property editor would store", () => {
  assert.equal(typedValue("4"), 4);
  assert.equal(typedValue("-2.5"), -2.5);
  assert.equal(typedValue("TRUE"), true);
  assert.equal(typedValue(" active "), "active");
  assert.equal(typedValue("2026-10-20"), "2026-10-20");
});

test("templates merge, and refuse two different values for one fact", () => {
  const a = { folder: "Work", tags: ["x"], properties: { type: "book" } };
  const b = { folder: "", tags: ["x", "y"], properties: { status: "unread" } };
  assert.deepEqual(mergeTemplates(a, b), { folder: "Work", tags: ["x", "y"], properties: { type: "book", status: "unread" } });
  assert.equal(mergeTemplates(a, { folder: "", tags: [], properties: { type: "paper" } }), null);
  assert.equal(mergeTemplates(a, { folder: "Play", tags: [], properties: {} }), null);
  assert.deepEqual(mergeTemplates(a, { folder: "Work", tags: [], properties: { type: "book" } })?.properties, { type: "book" });
});

const NOW = new Date(2026, 9, 17, 14, 30);
const c = (property: string, op: Condition["op"], value = ""): Condition => ({ property, op, value });

test("a section states the exact values it selects by", () => {
  const w = sectionWrite(
    blankSection({ id: "s", kind: "property", propertyKey: "type", propertyValue: "book", conditions: [c("status", "is", "unread")] }),
    NOW
  );
  assert.deepEqual(w.template, { folder: "", tags: [], properties: { type: "book", status: "unread" } });
  assert.ok(w.complete);
  assert.ok(acceptsMoves(w));
  assert.equal(describeTemplate(w.template), "Set type to book, status to unread");
});

test("filters state a fact only as a single literal entry", () => {
  const w = sectionWrite(
    blankSection({ id: "s", kind: "recent-created", filterTags: "#reading", filterProps: "status=active", filterFolders: "/Research/Papers/" }),
    NOW
  );
  assert.deepEqual(w.template, { folder: "Research/Papers", tags: ["reading"], properties: { status: "active" } });
  assert.ok(w.complete);
  assert.ok(!acceptsMoves(w), "a move never moves a file between folders");
  assert.equal(describeTemplate(w.template), "Set status to active and add #reading and file in Research/Papers");
  for (const over of [{ filterTags: "a, b" }, { filterTags: "proj/*" }, { filterProps: "status" }, { filterProps: "a=1, b=2" }, { filterFolders: "archive" }]) {
    assert.ok(!sectionWrite(blankSection({ id: "s", kind: "recent-created", ...over }), NOW).complete, JSON.stringify(over));
  }
});

test("a condition that names no value must already hold for a new note", () => {
  const holds = sectionWrite(
    blankSection({ id: "s", kind: "recent-modified", conditions: [c("status", "is", "waiting"), c("status", "is-not", "done"), c("file.ctime", "last-days", "7")] }),
    NOW
  );
  assert.ok(holds.complete);
  assert.deepEqual(holds.template.properties, { status: "waiting" });
  for (const cond of [c("rating", "gte", "4"), c("due", "exists"), c("file.mtime", "older-days", "30")]) {
    assert.ok(!sectionWrite(blankSection({ id: "s", kind: "recent-modified", conditions: [cond] }), NOW).complete, cond.op);
  }
  const clash = sectionWrite(blankSection({ id: "s", kind: "recent-modified", conditions: [c("status", "is", "a"), c("status", "is", "b")] }), NOW);
  assert.ok(!clash.complete, "two values for one property name no note");
});

test("sources that select by activity or age take no new notes", () => {
  for (const kind of ["recent-opened", "rediscover", "pinned", "continue", "related"] as const) {
    assert.ok(!sectionWrite(blankSection({ id: "s", kind, conditions: [c("status", "is", "x")] }), NOW).complete, kind);
  }
  const bare = sectionWrite(blankSection({ id: "s", kind: "recent-created" }), NOW);
  assert.ok(bare.complete);
  assert.ok(!acceptsMoves(bare), "a section that states nothing has no change to make");
  assert.ok(!sectionWrite(blankSection({ id: "s", kind: "property", propertyKey: "status" }), NOW).complete, "a key without a value");
});
