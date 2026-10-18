import assert from "node:assert/strict";
import { test } from "./harness";
import { composeSections } from "../src/compose/compose";
import { compilePageScope } from "../src/compose/scope";
import { VaultSnapshot } from "../src/compose/vault";
import { cloneSections, folderName, isInside, normalizeFolderPath, reparent } from "../src/settings/folders";
import { normalizePages, normalizeSettings } from "../src/settings/normalize";
import {
  findPageByName,
  legacyFolderPageId,
  refFromState,
  renamePageFolders,
  resolvePage,
  sameRef,
  scopeSummary,
  stateFromRef,
  suggestPageName,
  uniquePageName,
} from "../src/settings/pages";
import {
  blankScope,
  blankSection,
  defaultSettings,
  LIMITS,
  type NamedPage,
  type PageScope,
  type SectionConfig,
} from "../src/settings/schema";
import { fakeVault } from "./fake-vault";

const section = (over: Partial<SectionConfig>): SectionConfig => blankSection({ id: "t", ...over });
const scope = (over: Partial<PageScope>): PageScope => ({ ...blankScope(), ...over });
const page = (over: Partial<NamedPage>): NamedPage => ({
  id: "page-a",
  name: "A",
  scope: blankScope(),
  sections: null,
  ...over,
});

// ------------------------------------------------------------------- paths

test("folder paths normalize to one form", () => {
  assert.equal(normalizeFolderPath("/Work//Clients/"), "Work/Clients");
  assert.equal(normalizeFolderPath("Work\\Clients"), "Work/Clients");
  assert.equal(normalizeFolderPath("  Work / Clients "), "Work/Clients");
  assert.equal(normalizeFolderPath("/"), "");
  assert.equal(folderName("Work/Clients"), "Clients");
  assert.equal(folderName("Work"), "Work");
});

test("a path is inside a folder only at a segment boundary", () => {
  assert.ok(isInside("Work/a.md", "Work"));
  assert.ok(isInside("Work/Clients/a.md", "Work"));
  assert.ok(!isInside("Workshop/a.md", "Work"));
  assert.ok(!isInside("Work.md", "Work"));
  assert.ok(isInside("anything.md", ""));
});

test("cloned sections get new ids and leave the source alone", () => {
  const source = [section({ id: "a", count: 3 }), section({ id: "b" })];
  const copy = cloneSections(source);
  assert.deepEqual(copy.map((c) => c.count), [3, 8]);
  assert.ok(copy.every((c, i) => c.id !== source[i].id));
  assert.equal(source[0].id, "a");
});

test("a folder rename repoints folder pages at and under it, and nothing else", () => {
  assert.equal(reparent("Work/Clients", "Work", "Jobs"), "Jobs/Clients");
  assert.equal(reparent("Workshop", "Work", "Jobs"), "Workshop");
  const pages = [
    page({ id: "1", scope: scope({ kind: "folder", folder: "Work" }) }),
    page({ id: "2", scope: scope({ kind: "folder", folder: "Work/Clients" }) }),
    page({ id: "3", scope: scope({ kind: "folder", folder: "Workshop" }) }),
    page({ id: "4", scope: scope({ kind: "tag", tag: "x", folder: "Work" }) }),
  ];
  assert.ok(renamePageFolders(pages, "Work", "Jobs"));
  assert.deepEqual(pages.map((p) => p.scope.folder), ["Jobs", "Jobs/Clients", "Workshop", "Work"]);
  assert.ok(!renamePageFolders(pages, "Nowhere", "Else"));
});

// -------------------------------------------------------------- references

test("a saved view state reads back as the page it names, and junk as home", () => {
  assert.deepEqual(refFromState({ page: "page-a" }), { page: "page-a" });
  assert.deepEqual(refFromState({ folder: "/Work//Clients/" }), { folder: "Work/Clients" });
  assert.deepEqual(refFromState({ page: "page-a", folder: "Work" }), { page: "page-a" });
  for (const junk of [null, undefined, {}, { page: 4 }, { folder: 7 }, { folder: "/" }, "x"]) {
    assert.deepEqual(refFromState(junk), {});
  }
  assert.deepEqual(stateFromRef({ page: "p" }), { page: "p" });
  assert.deepEqual(stateFromRef({ folder: "Work" }), { folder: "Work" });
  assert.deepEqual(stateFromRef({}), {});
  assert.ok(sameRef({ folder: "Work" }, { folder: "Work" }));
  assert.ok(!sameRef({ folder: "Work" }, { page: "p" }));
  assert.ok(sameRef({}, {}));
});

test("home, named and folder pages resolve to their own sections and scope", () => {
  const own = [section({ id: "own", kind: "recent-created" })];
  const settings = {
    ...defaultSettings(),
    pages: [
      page({ id: "page-own", name: "Own", sections: own }),
      page({ id: "page-inherit", name: "Inherit", scope: scope({ kind: "tag", tag: "x" }) }),
      page({ id: "page-work", name: "Client work", scope: scope({ kind: "folder", folder: "Work" }) }),
    ],
  };
  const home = resolvePage(settings, {});
  assert.ok(home?.isHome);
  assert.equal(home.sections, settings.sections);
  assert.equal(resolvePage(settings, { page: "page-own" })?.sections, own);
  assert.equal(resolvePage(settings, { page: "page-inherit" })?.sections, settings.sections);
  assert.equal(resolvePage(settings, { page: "gone" }), null);

  // A folder with a named page opens that page, by whichever route.
  const viaFolder = resolvePage(settings, { folder: "Work" });
  const viaId = resolvePage(settings, { page: "page-work" });
  assert.equal(viaFolder?.title, "Client work");
  assert.equal(viaFolder?.key, viaId?.key);
  // A folder without one is a plain folder page on the home sections.
  const plain = resolvePage(settings, { folder: "Play/Games" });
  assert.equal(plain?.title, "Games");
  assert.equal(plain?.record, null);
  assert.equal(plain?.sections, settings.sections);
  assert.equal(plain?.scope.folder, "Play/Games");
  assert.notEqual(plain?.key, home.key);
});

// ------------------------------------------------------------------- names

test("page names stay unique without regard to case, and never blank", () => {
  const pages = [page({ id: "1", name: "Projects" }), page({ id: "2", name: "Projects 2" })];
  assert.equal(uniquePageName(pages, "Reading"), "Reading");
  assert.equal(uniquePageName(pages, " projects "), "projects 3");
  assert.equal(uniquePageName(pages, "Projects", "1"), "Projects");
  assert.equal(uniquePageName(pages, "   "), "Page");
  const long = "x".repeat(200);
  assert.equal(uniquePageName([], long).length, LIMITS.pageName.max);
  assert.ok(uniquePageName([page({ name: "x".repeat(60) })], long).length <= LIMITS.pageName.max);
});

test("a page without a name takes one from its scope", () => {
  assert.equal(suggestPageName(scope({ kind: "folder", folder: "Work/Clients" })), "Clients");
  assert.equal(suggestPageName(scope({ kind: "tag", tag: "#ideas" })), "#ideas");
  assert.equal(suggestPageName(scope({ kind: "property", propertyKey: "type", propertyValue: "Project" })), "type: Project");
  assert.equal(suggestPageName(scope({ kind: "property", propertyKey: "status" })), "status");
  assert.equal(suggestPageName(scope({ kind: "tag" })), "Page");
  assert.equal(scopeSummary(scope({ kind: "folder", folder: "Work" })), "Folder: Work");
  assert.equal(scopeSummary(scope({ kind: "tag", tag: "ideas" })), "Tag: #ideas");
  assert.equal(scopeSummary(scope({ kind: "folder" })), "Folder: not set");
  assert.equal(scopeSummary(blankScope()), "Whole vault");
});

test("a link finds a page by id or by name", () => {
  const pages = [page({ id: "page-a", name: "Reading list" })];
  assert.equal(findPageByName(pages, "page-a")?.name, "Reading list");
  assert.equal(findPageByName(pages, " READING LIST ")?.id, "page-a");
  assert.equal(findPageByName(pages, "other"), undefined);
  assert.equal(findPageByName(pages, "  "), undefined);
});

// ------------------------------------------------------------- stored data

test("stored pages are cleaned: ids, names, scopes, sections and the cap", () => {
  const good = [{ id: "x", kind: "recent-created", count: 4 }];
  const pages = normalizePages([
    { id: "page-1", name: "  Work  ", scope: { kind: "folder", folder: "/Work/" }, sections: good },
    { id: "page-1", name: "work", scope: { kind: "tag", tag: "#ideas" } },
    { id: "bad id!", scope: { kind: "nonsense", folder: 5 }, sections: [] },
    { name: "Third" },
    "junk",
  ]);
  assert.equal(pages.length, 4);
  assert.deepEqual(pages.map((p) => p.name), ["Work", "work 2", "Page", "Third"]);
  assert.equal(new Set(pages.map((p) => p.id)).size, 4);
  assert.deepEqual(pages[0].scope, scope({ kind: "folder", folder: "Work" }));
  assert.equal(pages[0].sections?.[0].count, 4);
  assert.equal(pages[1].scope.tag, "ideas");
  assert.equal(pages[2].scope.kind, "all");
  assert.equal(pages[2].sections, null, "an empty list means the home sections");
  assert.deepEqual(normalizePages("nope"), []);
  const many = Array.from({ length: LIMITS.pages.max + 9 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  assert.equal(normalizePages(many).length, LIMITS.pages.max);
  assert.deepEqual(normalizeSettings({}).pages, []);
});

test("folders saved by 1.30 become pages scoped to their folders, with stable ids", () => {
  const good = [{ id: "x", kind: "recent-created", count: 4 }];
  const stored = {
    folderPages: [
      { path: "/Work/Clients/", sections: good },
      { path: "", sections: good },
      { path: "Play", sections: good },
      "junk",
    ],
  };
  const settings = normalizeSettings(stored);
  assert.deepEqual(settings.pages.map((p) => p.name), ["Clients", "Play"]);
  assert.deepEqual(settings.pages.map((p) => p.scope.folder), ["Work/Clients", "Play"]);
  assert.ok(settings.pages.every((p) => p.scope.kind === "folder"));
  assert.equal(settings.pages[0].sections?.[0].count, 4);
  // The same data loads to the same ids every time, so saved tabs find their page.
  assert.deepEqual(normalizeSettings(stored).pages.map((p) => p.id), settings.pages.map((p) => p.id));
  assert.equal(settings.pages[0].id, legacyFolderPageId("Work/Clients"));
  assert.notEqual(legacyFolderPageId("Work"), legacyFolderPageId("Play"));
  assert.ok(!("folderPages" in settings));
  // Pages already saved win over the old key.
  const both = normalizeSettings({ ...stored, pages: [{ id: "page-z", name: "Z" }] });
  assert.deepEqual(both.pages.map((p) => p.id), ["page-z"]);
});

// ------------------------------------------------------------------ scopes

const v = fakeVault([
  { path: "Work/a.md", mtime: 50, fm: { type: "Project", tags: ["ideas/new"] } },
  { path: "Work/Clients/b.md", mtime: 40, tags: ["#client"] },
  { path: "Workshop/c.md", mtime: 90, fm: { type: ["Idea", "Project"] } },
  { path: "d.md", mtime: 60, fm: { Type: "Note", status: "" } },
]);
const paths = (s: PageScope) =>
  new VaultSnapshot(v.app, new Date(), [], compilePageScope(s)).files.map((f) => f.path).sort();

test("a folder scope lists the folder's subtree and stops at the segment boundary", () => {
  assert.deepEqual(paths(scope({ kind: "folder", folder: "Work" })), ["Work/Clients/b.md", "Work/a.md"]);
  assert.deepEqual(paths(scope({ kind: "folder", folder: "Work/Clients" })), ["Work/Clients/b.md"]);
});

test("a folder named with glob characters is taken literally", () => {
  assert.equal(compilePageScope(scope({ kind: "folder", folder: "Work*" }))?.({ path: "Work/a.md" } as never, null), false);
});

test("a tag scope takes the tag and its descendants, frontmatter or inline", () => {
  assert.deepEqual(paths(scope({ kind: "tag", tag: "ideas" })), ["Work/a.md"]);
  assert.deepEqual(paths(scope({ kind: "tag", tag: "#client" })), ["Work/Clients/b.md"]);
  assert.deepEqual(paths(scope({ kind: "tag", tag: "nothing" })), []);
});

test("a property scope takes a key, or a key and a value, in any case or list", () => {
  assert.deepEqual(paths(scope({ kind: "property", propertyKey: "type" })), ["Work/a.md", "Workshop/c.md", "d.md"]);
  assert.deepEqual(paths(scope({ kind: "property", propertyKey: "type", propertyValue: "project" })), ["Work/a.md", "Workshop/c.md"]);
  assert.deepEqual(paths(scope({ kind: "property", propertyKey: "status" })), [], "an empty value does not count");
});

test("a scope with nothing to match admits every note", () => {
  for (const s of [blankScope(), scope({ kind: "folder" }), scope({ kind: "tag", tag: "  " }), scope({ kind: "property" })]) {
    assert.equal(compilePageScope(s), null);
    assert.equal(paths(s).length, 4);
  }
});

test("a page composes its own sections over only the notes in its scope", async () => {
  const settings = { ...defaultSettings(), sections: [section({ id: "m", kind: "recent-modified" })] };
  const work = compilePageScope(scope({ kind: "folder", folder: "Work" }));
  const inherited = await composeSections(v.app, settings, { scope: work });
  assert.deepEqual(inherited[0].cards.map((c) => c.file.path), ["Work/a.md", "Work/Clients/b.md"]);

  const own = [section({ id: "c", kind: "recent-created", count: 1 })];
  const custom = await composeSections(v.app, settings, { sections: own, scope: work });
  assert.equal(custom.length, 1);
  assert.equal(custom[0].config.id, "c");
  assert.equal(custom[0].cards.length, 1);

  const home = await composeSections(v.app, settings);
  assert.equal(home[0].cards.length, 4);
});
