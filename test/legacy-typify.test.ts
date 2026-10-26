/**
 * The Typify icon reader: read once, kept until cleared, and nothing when
 * the glyph setting does not ask for Typify's icons.
 */

import assert from "node:assert/strict";
import { test } from "vitest";
import { TypifyIcons } from "../src/render/legacy-typify";
import { defaultSettings } from "../src/settings/schema";
import { fakeVault } from "./fake-vault";

const typify = JSON.stringify({
  statusStyles: [
    { name: "Report", icon: "file-text" },
    { name: "Memo", icon: "sticky-note", appliesTo: ["kind"] },
    { name: "", icon: "x" },
  ],
});

function counting() {
  const v = fakeVault([], { typify });
  let reads = 0;
  const adapter = v.app.vault.adapter;
  const read = adapter.read.bind(adapter);
  adapter.read = (path: string) => {
    reads++;
    return read(path);
  };
  return { app: v.app, reads: () => reads };
}

test("Typify's icons are read once and kept until cleared", async () => {
  const { app, reads } = counting();
  const icons = new TypifyIcons(app);
  const on = { ...defaultSettings(), typifyIcons: true };
  assert.deepEqual([...(await icons.for(on))], [["report", "file-text"]]);
  await icons.for(on);
  assert.equal(reads(), 1);
  icons.clear();
  await icons.for(on);
  assert.equal(reads(), 2);
  assert.deepEqual([...(await icons.for({ ...on, typeProperty: "kind" }))], [["memo", "sticky-note"]], "another type property reads again");
  assert.equal(reads(), 3);
});

test("no icons, and no read, unless the glyph setting asks for Typify's", async () => {
  const { app, reads } = counting();
  const icons = new TypifyIcons(app);
  assert.equal((await icons.for(defaultSettings())).size, 0);
  assert.equal((await icons.for({ ...defaultSettings(), typifyIcons: true, showGlyph: false })).size, 0);
  assert.equal(reads(), 0);
});
