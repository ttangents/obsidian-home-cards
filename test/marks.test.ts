import assert from "node:assert/strict";
import { test } from "vitest";
import {
  dateAfter,
  forgetMarks,
  isPinned,
  isSnoozed,
  localDate,
  pruneSnoozes,
  renameMarks,
  snooze,
  togglePin,
  toggleQuiet,
} from "../src/compose/marks";
import { rankSection } from "../src/compose/rank";
import { VaultSnapshot } from "../src/compose/vault";
import { normalizeMarks, normalizeSettings } from "../src/settings/normalize";
import { blankSection, defaultSettings, emptyMarks, LIMITS } from "../src/settings/schema";
import { fakeVault } from "./fake-vault";

const NOW = new Date(2026, 9, 17, 14, 30);

test("dates for snoozes are local calendar days", () => {
  assert.equal(localDate(NOW), "2026-10-17");
  assert.equal(dateAfter(NOW, 7), "2026-10-24");
  assert.equal(dateAfter(new Date(2026, 11, 28), 7), "2027-01-04");
});

test("a pin goes first and ends a snooze; pinning again unpins", () => {
  const m = emptyMarks();
  snooze(m, "a.md", NOW, 7);
  togglePin(m, "b.md");
  togglePin(m, "a.md");
  assert.deepEqual(m.pinned, ["a.md", "b.md"]);
  assert.equal(m.snoozed["a.md"], undefined);
  togglePin(m, "b.md");
  assert.deepEqual(m.pinned, ["a.md"]);
  assert.ok(isPinned(m, "a.md"));
});

test("a snooze lasts until the morning of its return date", () => {
  const m = emptyMarks();
  snooze(m, "a.md", NOW, 7);
  assert.equal(m.snoozed["a.md"], "2026-10-24");
  assert.ok(isSnoozed(m, "a.md", new Date(2026, 9, 23, 23, 59)));
  assert.ok(!isSnoozed(m, "a.md", new Date(2026, 9, 24, 0, 0)));
  assert.ok(!pruneSnoozes(m, new Date(2026, 9, 23)));
  assert.ok(pruneSnoozes(m, new Date(2026, 9, 24)));
  assert.deepEqual(m.snoozed, {});
});

test("marks follow a renamed note or folder and leave with a deleted one", () => {
  const m = emptyMarks();
  m.pinned.push("Work/a.md", "Workshop/b.md", "c.md");
  m.quiet.push("Work/Deep/d.md");
  m.snoozed["Work/e.md"] = "2026-11-01";
  assert.ok(renameMarks(m, "Work", "Jobs"));
  assert.deepEqual(m.pinned, ["Jobs/a.md", "Workshop/b.md", "c.md"]);
  assert.deepEqual(m.quiet, ["Jobs/Deep/d.md"]);
  assert.deepEqual(m.snoozed, { "Jobs/e.md": "2026-11-01" });
  assert.ok(renameMarks(m, "c.md", "C.md"));
  assert.ok(!renameMarks(m, "nothing", "else"));
  assert.ok(forgetMarks(m, "Jobs"));
  assert.deepEqual(m.pinned, ["Workshop/b.md", "C.md"]);
  assert.deepEqual(m.quiet, []);
  assert.deepEqual(m.snoozed, {});
  assert.ok(!forgetMarks(m, "nope.md"));
});

test("marks stay within their caps, dropping the oldest or soonest-ending", () => {
  const m = emptyMarks();
  for (let i = 0; i < LIMITS.pinned.max + 5; i++) togglePin(m, `${i}.md`);
  assert.equal(m.pinned.length, LIMITS.pinned.max);
  assert.equal(m.pinned[0], `${LIMITS.pinned.max + 4}.md`);
  for (let i = 0; i < LIMITS.snoozed.max + 3; i++) snooze(m, `s${i}.md`, NOW, i < 3 ? 1 : 30);
  assert.equal(Object.keys(m.snoozed).length, LIMITS.snoozed.max);
  assert.equal(m.snoozed["s0.md"], undefined, "the snooze ending soonest went first");
  toggleQuiet(m, "q.md");
  toggleQuiet(m, "q.md");
  assert.deepEqual(m.quiet, []);
});

test("stored marks are cleaned", () => {
  const m = normalizeMarks({
    pinned: ["a.md", "a.md", 4, "", "b.md"],
    snoozed: { "a.md": "2026-10-24", "b.md": "next week", "": "2026-10-24", "c.md": 7 },
    quiet: "nope",
  });
  assert.deepEqual(m, { pinned: ["a.md", "b.md"], snoozed: { "a.md": "2026-10-24" }, quiet: [] });
  assert.deepEqual(normalizeSettings({}).marks, emptyMarks());
});

const v = fakeVault([
  { path: "a.md", mtime: new Date(2026, 9, 10).getTime(), fm: { status: "active" } },
  { path: "b.md", mtime: new Date(2026, 9, 9).getTime() },
  { path: "old.md", mtime: new Date(2020, 0, 1).getTime() },
]);

test("Pinned lists pins in pin order; a snoozed note leaves every other section", () => {
  const settings = { ...defaultSettings(), marks: emptyMarks() };
  togglePin(settings.marks, "b.md");
  togglePin(settings.marks, "a.md");
  snooze(settings.marks, "a.md", NOW, 7); // pinned notes may still be snoozed by hand
  snooze(settings.marks, "b.md", NOW, 7);
  togglePin(settings.marks, "a.md");
  togglePin(settings.marks, "a.md"); // a.md: pinned again, snooze ended
  const snap = new VaultSnapshot(v.app, NOW);
  const ids = (kind: "pinned" | "recent-modified" | "rediscover") =>
    rankSection(snap, blankSection({ id: kind, kind }), settings).map((r) => r.file.path);
  assert.deepEqual(ids("pinned"), ["a.md", "b.md"], "snoozed b.md stays in Pinned");
  assert.deepEqual(ids("recent-modified"), ["a.md", "old.md"]);
  assert.deepEqual(ids("rediscover"), ["old.md"]);
  toggleQuiet(settings.marks, "old.md");
  assert.deepEqual(ids("rediscover"), [], "Rediscover passes over a quiet note");
  assert.deepEqual(ids("recent-modified"), ["a.md", "old.md"], "and only Rediscover does");
});
