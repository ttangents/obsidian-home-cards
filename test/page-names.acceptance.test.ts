import assert from "node:assert/strict";
import { test } from "vitest";
import { resolvePage } from "../src/settings/pages";
import { blankScope, defaultSettings, type NamedPage, type PageScope } from "../src/settings/schema";

/**
 * Acceptance for HC-1 (PLAN, Next: a folder page and a named page can share a name). Claude's choice: a
 * plain folder page whose name a named page already uses says it is a folder, so the reader can tell the
 * two apart; a page with a record keeps its own name. Protected: the worker's change must make this pass
 * unchanged.
 */
const page = (id: string, name: string, scope: Partial<PageScope>): NamedPage => ({
  id,
  name,
  scope: { ...blankScope(), ...scope },
  cssClass: "",
  sections: null,
});

const withPages = (...pages: NamedPage[]) => ({ ...defaultSettings(), pages });

test("a plain folder page that shares a named page's name is titled as a folder", () => {
  const settings = withPages(page("page-projects", "Projects", { kind: "property", propertyKey: "type", propertyValue: "project" }));
  assert.equal(resolvePage(settings, { folder: "Projects" })?.title, "Projects (folder)");
  assert.equal(resolvePage(settings, { folder: "Work/Projects" })?.title, "Projects (folder)");
});

test("the comparison ignores case", () => {
  const settings = withPages(page("page-projects", "projects", { kind: "tag", tag: "project" }));
  assert.equal(resolvePage(settings, { folder: "Projects" })?.title, "Projects (folder)");
});

test("the named page keeps its own name", () => {
  const settings = withPages(page("page-projects", "Projects", { kind: "tag", tag: "project" }));
  assert.equal(resolvePage(settings, { page: "page-projects" })?.title, "Projects");
});

test("a folder page with no namesake keeps the folder's name", () => {
  const settings = withPages(page("page-reading", "Reading", { kind: "tag", tag: "book" }));
  assert.equal(resolvePage(settings, { folder: "Projects" })?.title, "Projects");
  assert.equal(resolvePage(withPages(), { folder: "Projects" })?.title, "Projects");
});

test("a folder that has its own named page shows that page, under its name", () => {
  const settings = withPages(page("page-folder", "Projects", { kind: "folder", folder: "Projects" }));
  const resolved = resolvePage(settings, { folder: "Projects" });
  assert.equal(resolved?.title, "Projects");
  assert.equal(resolved?.record?.id, "page-folder");
});
