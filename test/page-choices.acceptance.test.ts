import assert from "node:assert/strict";
import { test } from "vitest";
import { pageChoices, scopeSummary } from "../src/settings/pages";
import { blankScope, defaultSettings, type NamedPage, type PageScope } from "../src/settings/schema";

/**
 * Acceptance for HC-2 (PLAN, Now: make pages easier to find). Claude's design: the page picker's list is
 * one pure function, `pageChoices`, which a "Pages" button on every page's header opens, the home page
 * included, so every saved page, folder pages with a record among them, is one click from the home page.
 * Protected: the worker's change must make this pass unchanged.
 */
const page = (id: string, name: string, scope: Partial<PageScope>): NamedPage => ({
  id,
  name,
  scope: { ...blankScope(), ...scope },
  cssClass: "",
  sections: null,
});

test("the choices are the home page, then every named page in settings order", () => {
  const reading = page("page-reading", "Reading", { kind: "tag", tag: "book" });
  const work = page("page-work", "Client work", { kind: "folder", folder: "Work" });
  const choices = pageChoices({ ...defaultSettings(), pages: [reading, work] });
  assert.deepEqual(choices, [
    { ref: {}, title: "Home", note: "The home page" },
    { ref: { page: "page-reading" }, title: "Reading", note: scopeSummary(reading.scope) },
    { ref: { page: "page-work" }, title: "Client work", note: scopeSummary(work.scope) },
  ]);
});

test("with no named pages, the home page is the only choice", () => {
  assert.deepEqual(pageChoices({ ...defaultSettings(), pages: [] }), [
    { ref: {}, title: "Home", note: "The home page" },
  ]);
});
