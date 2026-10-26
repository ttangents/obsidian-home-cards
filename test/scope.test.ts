import assert from "node:assert/strict";
import { test } from "vitest";
import { compileScope, tagsOf } from "../src/compose/scope";
import { fakeVault } from "./fake-vault";

const v = fakeVault([
  { path: "Stuff/Vendors/acme.md", fm: { type: "Organization", tags: ["firm/vendor"] } },
  { path: "Stuff/interviews/2026/q1.md", fm: { type: "Interview", status: "done" }, tags: ["my/deliverable/report"] },
  { path: "root.md", fm: { Type: "organization", status: "" } },
]);
const cacheOf = (p: string) => v.app.metadataCache.getFileCache(v.file(p));
const run = (scope: Partial<Record<"filterTags" | "filterProps" | "filterFolders", string>>) => {
  const test = compileScope({ filterTags: "", filterProps: "", filterFolders: "", ...scope });
  return ["Stuff/Vendors/acme.md", "Stuff/interviews/2026/q1.md", "root.md"].filter(
    (p) => !test || test(v.file(p), cacheOf(p))
  );
};

test("an empty scope compiles to null", () => {
  assert.equal(compileScope({ filterTags: " ", filterProps: "", filterFolders: "," }), null);
});

test("tags: bare names include descendants; wildcards bound the match", () => {
  assert.deepEqual(run({ filterTags: "my/deliverable" }), ["Stuff/interviews/2026/q1.md"]);
  assert.deepEqual(run({ filterTags: "firm/vendor*" }), ["Stuff/Vendors/acme.md"]);
  assert.deepEqual(run({ filterTags: "#firm" }), ["Stuff/Vendors/acme.md"]);
  assert.deepEqual(run({ filterTags: "firm/vend" }), []);
});

test("properties: key requires a non-empty value; key=value matches case-insensitively", () => {
  assert.deepEqual(run({ filterProps: "type=organization" }), ["Stuff/Vendors/acme.md", "root.md"]);
  assert.deepEqual(run({ filterProps: "status" }), ["Stuff/interviews/2026/q1.md"]);
});

test("folders: paths match subtrees; bare names match any segment", () => {
  assert.deepEqual(run({ filterFolders: "/Stuff/*" }), ["Stuff/Vendors/acme.md", "Stuff/interviews/2026/q1.md"]);
  assert.deepEqual(run({ filterFolders: "interviews" }), ["Stuff/interviews/2026/q1.md"]);
  assert.deepEqual(run({ filterFolders: "Stuff/Vendors" }), ["Stuff/Vendors/acme.md"]);
});

test("fields AND together; patterns within a field OR", () => {
  assert.deepEqual(run({ filterProps: "type=organization", filterFolders: "Stuff" }), ["Stuff/Vendors/acme.md"]);
  assert.deepEqual(run({ filterFolders: "Vendors, interviews" }).length, 2);
});

test("regex syntax in patterns is literal", () => {
  assert.deepEqual(run({ filterFolders: "(.*)" }), []);
});

test("tagsOf lists frontmatter tags then inline tags, without #", () => {
  assert.deepEqual(tagsOf(cacheOf("Stuff/interviews/2026/q1.md")), ["my/deliverable/report"]);
  assert.deepEqual(tagsOf(cacheOf("Stuff/Vendors/acme.md")), ["firm/vendor"]);
  assert.deepEqual(tagsOf(null), []);
});
