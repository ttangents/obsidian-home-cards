import assert from "node:assert/strict";
import { test } from "vitest";
import { folderPageTitle, pageChoices, resolvePage, scopeSummary } from "../src/settings/pages";
import { blankScope, defaultSettings, type NamedPage, type PageScope } from "../src/settings/schema";

/**
 * Acceptance for HC-4 (PLAN, Now: make pages easier to find). HC-2's picker lists the home page and the named
 * pages; this adds every folder page, so the "Pages" button reaches each page a reader can open. Claude's design:
 * folder pages follow the named pages in path order, titled as the folder page itself is titled. Protected.
 */
const page = (id: string, name: string, scope: Partial<PageScope>): NamedPage => ({
  id,
  name,
  scope: { ...blankScope(), ...scope },
  cssClass: "",
  sections: null,
});

const reading = page("page-reading", "Reading", { kind: "tag", tag: "book" });
const projects = page("page-projects", "Projects", { kind: "property", property: "type", value: "project" });
const work = page("page-work", "Client work", { kind: "folder", folder: "Work" });
const settings = { ...defaultSettings(), pages: [reading, projects, work] };

test("folder pages follow the named pages, in path order, each with its path as the note", () => {
  assert.deepEqual(pageChoices(settings, ["Notes/Daily", "Archive", "Notes"]), [
    { ref: {}, title: "Home", note: "The home page" },
    { ref: { page: "page-reading" }, title: "Reading", note: scopeSummary(reading.scope) },
    { ref: { page: "page-projects" }, title: "Projects", note: scopeSummary(projects.scope) },
    { ref: { page: "page-work" }, title: "Client work", note: scopeSummary(work.scope) },
    { ref: { folder: "Archive" }, title: "Archive", note: "Archive" },
    { ref: { folder: "Notes" }, title: "Notes", note: "Notes" },
    { ref: { folder: "Notes/Daily" }, title: "Daily", note: "Notes/Daily" },
  ]);
});

test("a folder with its own named page is listed once, as that page, and the vault root is left out", () => {
  const folders = pageChoices(settings, ["/", "", "Work", "Archive"]).flatMap((c) => (c.ref.folder ? [c.ref.folder] : []));
  assert.deepEqual(folders, ["Archive"]);
});

test("a folder page shares the title the page itself shows, with (folder) beside a named page's name", () => {
  const choices = pageChoices(settings, ["Archive/projects"]);
  assert.deepEqual(choices[choices.length - 1], {
    ref: { folder: "Archive/projects" },
    title: "projects (folder)",
    note: "Archive/projects",
  });
  assert.equal(folderPageTitle(settings.pages, "Archive/projects"), "projects (folder)");
  assert.equal(folderPageTitle(settings.pages, "Archive"), "Archive");
  assert.equal(resolvePage(settings, { folder: "Archive/projects" })?.title, "projects (folder)");
});

test("with no folders given, the choices are as before", () => {
  assert.equal(pageChoices(settings).length, 4);
});
