/**
 * Pagewise, the optional companion plugin: what Home Cards accepts from it and
 * the toolbar button it offers.
 */

import assert from "node:assert/strict";
import { test } from "vitest";
import { asPagewiseApi, notePageButton, PAGEWISE_CONTRACT } from "../src/compose/pagewise";

const api = { version: PAGEWISE_CONTRACT, registerToolbarItem: () => () => undefined };

test("accepts Pagewise's API only at the known contract version", () => {
  assert.equal(asPagewiseApi(api), api);
  assert.equal(asPagewiseApi({ ...api, version: 2 }), null);
  assert.equal(asPagewiseApi({ version: PAGEWISE_CONTRACT }), null);
  assert.equal(asPagewiseApi(null), null);
  assert.equal(asPagewiseApi("pagewise"), null);
});

test("the toolbar button opens the note's page and shows only for Markdown notes", () => {
  const opened: string[] = [];
  const button = notePageButton((path) => opened.push(path));
  const note = { file: { path: "Notes/Pricing.md", extension: "md" } };
  const canvas = { file: { path: "Board.canvas", extension: "canvas" } };
  assert.equal(button.isVisible(note), true);
  assert.equal(button.isVisible(canvas), false);
  assert.equal(button.isVisible({ file: null }), false);
  button.onClick(note);
  button.onClick(canvas);
  button.onClick({ file: null });
  assert.deepEqual(opened, ["Notes/Pricing.md"]);
  assert.equal(button.readingView, true);
});
