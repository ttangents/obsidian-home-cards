import assert from "node:assert/strict";
import { test } from "./harness";
import { composeSections } from "../src/compose/compose";
import { VaultSnapshot } from "../src/compose/vault";
import {
  cloneSections,
  folderName,
  isInside,
  normalizeFolderPath,
  renameFolderPages,
  reparent,
  sectionsFor,
} from "../src/settings/folder-pages";
import { normalizeFolderPages, normalizeSettings } from "../src/settings/normalize";
import { BLANK_SECTION, defaultSettings, type FolderPage, type SectionConfig } from "../src/settings/schema";
import { fakeVault } from "./fake-vault";

const section = (over: Partial<SectionConfig>): SectionConfig => ({ ...BLANK_SECTION, id: "t", ...over });

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

test("a folder page uses its own sections when it has them, else the home page's", () => {
  const own = [section({ id: "own", kind: "recent-created" })];
  const settings = { ...defaultSettings(), folderPages: [{ path: "Work", sections: own }] };
  assert.equal(sectionsFor(settings, "Work"), own);
  assert.equal(sectionsFor(settings, "Play"), settings.sections);
  assert.equal(sectionsFor(settings, ""), settings.sections);
});

test("cloned sections get new ids and leave the source alone", () => {
  const source = [section({ id: "a", count: 3 }), section({ id: "b" })];
  const copy = cloneSections(source);
  assert.deepEqual(copy.map((c) => c.count), [3, 8]);
  assert.ok(copy.every((c, i) => c.id !== source[i].id));
  assert.equal(source[0].id, "a");
});

test("a folder rename repoints the page and its nested pages, and nothing else", () => {
  assert.equal(reparent("Work/Clients", "Work", "Jobs"), "Jobs/Clients");
  assert.equal(reparent("Workshop", "Work", "Jobs"), "Workshop");
  const pages: FolderPage[] = [
    { path: "Work", sections: [] },
    { path: "Work/Clients", sections: [] },
    { path: "Workshop", sections: [] },
  ];
  assert.ok(renameFolderPages(pages, "Work", "Jobs"));
  assert.deepEqual(pages.map((p) => p.path), ["Jobs", "Jobs/Clients", "Workshop"]);
  assert.ok(!renameFolderPages(pages, "Nowhere", "Else"));
});

test("stored folder pages are cleaned: bad paths, duplicates and empty lists are dropped", () => {
  const good = [{ id: "x", kind: "recent-created", count: 4 }];
  const pages = normalizeFolderPages([
    { path: "/Work/", sections: good },
    { path: "Work", sections: good },
    { path: "", sections: good },
    { path: "Empty", sections: [] },
    { path: "NoList" },
    "junk",
    { path: "Play", sections: good },
  ]);
  assert.deepEqual(pages.map((p) => p.path), ["Work", "Play"]);
  assert.equal(pages[0].sections[0].count, 4);
  assert.deepEqual(normalizeFolderPages("nope"), []);
  assert.deepEqual(normalizeSettings({}).folderPages, []);
});

const v = fakeVault([
  { path: "Work/a.md", mtime: 50 },
  { path: "Work/Clients/b.md", mtime: 40 },
  { path: "Workshop/c.md", mtime: 90 },
  { path: "d.md", mtime: 60 },
]);

test("a folder snapshot lists only the notes under the folder", () => {
  const paths = (folder: string) => new VaultSnapshot(v.app, new Date(), [], folder).files.map((f) => f.path).sort();
  assert.deepEqual(paths("Work"), ["Work/Clients/b.md", "Work/a.md"]);
  assert.deepEqual(paths("Work/Clients"), ["Work/Clients/b.md"]);
  assert.equal(paths("").length, 4);
});

test("a folder page composes the home sections limited to the folder", async () => {
  const settings = { ...defaultSettings(), sections: [section({ id: "m", kind: "recent-modified" })] };
  const page = await composeSections(v.app, settings, { folder: "Work" });
  assert.deepEqual(page[0].cards.map((c) => c.file.path), ["Work/a.md", "Work/Clients/b.md"]);
});

test("a folder page with sections of its own ignores the home sections", async () => {
  const settings = {
    ...defaultSettings(),
    sections: [section({ id: "m", kind: "recent-modified" })],
    folderPages: [{ path: "Work", sections: [section({ id: "c", kind: "recent-created", count: 1 })] }],
  };
  const page = await composeSections(v.app, settings, { folder: "Work" });
  assert.equal(page.length, 1);
  assert.equal(page[0].config.id, "c");
  assert.equal(page[0].cards.length, 1);
  const home = await composeSections(v.app, settings);
  assert.equal(home[0].config.id, "m");
  assert.equal(home[0].cards.length, 4);
});
