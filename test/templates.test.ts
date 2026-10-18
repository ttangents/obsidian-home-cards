import assert from "node:assert/strict";
import { test } from "./harness";
import { hasFacts, literalTag, mergeTemplates, templateForScope, typedValue } from "../src/compose/templates";
import { blankScope, type PageScope } from "../src/settings/schema";

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
