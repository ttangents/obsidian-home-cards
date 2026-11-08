import assert from "node:assert/strict";
import { test } from "vitest";
import { sidebarStep } from "../src/compose/sidebar";

const listing = { listingPage: true, inSidebar: false };
const note = { listingPage: false, inSidebar: false };
const panel = { listingPage: false, inSidebar: true };

test("a listing page closes an open sidebar and remembers it did", () => {
  assert.deepEqual(sidebarStep(false, listing, false), { step: "close", closedByHome: true });
});

test("a listing page leaves a sidebar the reader closed alone, and does not claim it", () => {
  assert.deepEqual(sidebarStep(false, listing, true), { step: "none", closedByHome: false });
});

test("returning to a note reopens the sidebar Home Cards closed", () => {
  assert.deepEqual(sidebarStep(true, note, true), { step: "reopen", closedByHome: false });
});

test("returning to a note leaves a sidebar the reader closed alone", () => {
  assert.deepEqual(sidebarStep(false, note, true), { step: "none", closedByHome: false });
});

test("a sidebar the reader opened again on a listing page stays open on the way to a note", () => {
  assert.deepEqual(sidebarStep(true, note, false), { step: "none", closedByHome: false });
});

test("moving between two listing pages keeps the sidebar closed and claimed", () => {
  assert.deepEqual(sidebarStep(true, listing, true), { step: "none", closedByHome: true });
});

test("a click in a sidebar panel changes nothing", () => {
  assert.deepEqual(sidebarStep(true, panel, true), { step: "none", closedByHome: true });
  assert.deepEqual(sidebarStep(false, panel, false), { step: "none", closedByHome: false });
});
