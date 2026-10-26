import assert from "node:assert/strict";
import { test } from "vitest";
import { cleanTitle, dekSignature, extractDek, splitSentences } from "../src/compose/text";
import { defaultSettings } from "../src/settings/schema";
import { fakeVault } from "./fake-vault";

const s = { ...defaultSettings(), titlePrefixes: "(Report Update 2026), (Report), (Blog)" };

test("cleanTitle strips a configured prefix and a trailing date stamp", () => {
  assert.equal(cleanTitle("(Report) Treat agents as skills", s), "Treat agents as skills");
  assert.equal(cleanTitle("Vendor briefing @20260716", s), "Vendor briefing");
  assert.equal(cleanTitle("Vendor briefing, 2026-07-16", s), "Vendor briefing");
  assert.equal(cleanTitle("Roadmap on @2026-07-16 update", s), "Roadmap");
});

test("cleanTitle keeps numbers that are not date stamps", () => {
  assert.equal(cleanTitle("Invoice 12345678", s), "Invoice 12345678");
  assert.equal(cleanTitle("Review @20261399", s), "Review @20261399");
});

test("cleanTitle keeps a title that is only a date", () => {
  assert.equal(cleanTitle("2026-07-16", s), "2026-07-16");
});

test("cleanTitle honors the trailing-date toggle", () => {
  const off = { ...s, stripTrailingDates: false };
  assert.equal(cleanTitle("Vendor briefing @20260716", off), "Vendor briefing @20260716");
});

test("extractDek prefers the summary property", async () => {
  const v = fakeVault([{ path: "a.md", fm: { summary: "From the property." }, body: "Body text sentence here." }]);
  const f = v.file("a.md");
  assert.equal(await extractDek(v.app, f, v.app.metadataCache.getFileCache(f), s), "From the property.");
  assert.equal(v.reads.get("a.md"), undefined);
});

test("extractDek reads the first paragraph and skips boilerplate and fragments", async () => {
  const v = fakeVault([
    {
      path: "a.md",
      body: "# Heading\n\n```\ncode here that is long\n```\n\nThis note records a call. Draft. Agents need a [[control plane|control plane]] to scale.",
    },
  ]);
  const f = v.file("a.md");
  const dek = await extractDek(v.app, f, v.app.metadataCache.getFileCache(f), s);
  assert.equal(dek, "Agents need a control plane to scale.");
});

test("extractDek returns empty for no prose, deks off, or a failed read", async () => {
  const v = fakeVault([
    { path: "list.md", body: "- one item\n- two items" },
    { path: "prose.md", body: "A perfectly ordinary opening sentence." },
  ]);
  const list = v.file("list.md");
  assert.equal(await extractDek(v.app, list, v.app.metadataCache.getFileCache(list), s), "");
  const prose = v.file("prose.md");
  const off = { ...s, showDeks: false };
  assert.equal(await extractDek(v.app, prose, v.app.metadataCache.getFileCache(prose), off), "");
  const ghost = { ...prose, path: "ghost.md" };
  assert.equal(await extractDek(v.app, ghost, v.app.metadataCache.getFileCache(prose), s), "");
});

test("dekSignature changes only with extraction settings", () => {
  const base = dekSignature(s);
  assert.equal(dekSignature({ ...s, titlePrefixes: "x" }), base);
  assert.notEqual(dekSignature({ ...s, summaryProperty: "abstract" }), base);
  assert.notEqual(dekSignature({ ...s, boilerplateOpeners: "" }), base);
});

test("splitSentences breaks at end punctuation followed by space or the end", () => {
  assert.deepEqual(splitSentences("A 3.14 value. Next one! Last?"), ["A 3.14 value.", "Next one!", "Last?"]);
  assert.deepEqual(splitSentences("Wait... what? Yes."), ["Wait...", "what?", "Yes."]);
  assert.deepEqual(splitSentences("No end punctuation"), ["No end punctuation"]);
  assert.deepEqual(splitSentences(""), []);
});

test("no source file uses a regex lookbehind", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []
    );
  for (const file of walk("src")) assert.ok(!/\(\?<[=!]/.test(readFileSync(file, "utf8")), file);
});
