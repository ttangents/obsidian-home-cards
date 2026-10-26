/**
 * The settings store: when edits are written and when settings that sync
 * brings from another device replace the ones in memory.
 */

import assert from "node:assert/strict";
import { test } from "./harness";
import { pruneSnoozes } from "../src/compose/marks";
import { SettingsStore, type Debounced } from "../src/settings/store";
import type { HomeCardsSettings } from "../src/settings/schema";

/** data.json on a fake disk, a timer the test fires by hand, and a record of saves. */
function harness(initial: unknown) {
  const disk = { data: initial };
  const saves: HomeCardsSettings[] = [];
  let scheduled: (() => void) | null = null;
  const reloads: number[] = [];
  const store = new SettingsStore({
    storage: {
      load: () => Promise.resolve(structuredClone(disk.data)),
      save: (settings) => {
        saves.push(structuredClone(settings));
        disk.data = structuredClone(settings);
        return Promise.resolve();
      },
    },
    debounce: (run) => {
      const call = (() => {
        scheduled = run;
      }) as Debounced;
      call.cancel = () => {
        scheduled = null;
      };
      return call;
    },
    tidy: (settings) => void pruneSnoozes(settings.marks, new Date(2026, 9, 26)),
    afterReload: () => reloads.push(reloads.length),
  });
  return {
    store,
    disk,
    saves,
    reloads,
    fire: () => {
      const run = scheduled;
      scheduled = null;
      run?.();
    },
  };
}

const ENDED = { marks: { pinned: [], quiet: [], snoozed: { "Old.md": "2026-01-01" } } };

test("an ended snooze is dropped in memory without counting as an edit", async () => {
  const h = harness(ENDED);
  assert.equal(await h.store.load(), true);
  assert.deepEqual(h.store.settings.marks.snoozed, {});
  assert.equal(h.store.pending, false);
  assert.equal(h.saves.length, 0);
});

test("an ended snooze does not hold back settings that arrive by sync", async () => {
  const h = harness(ENDED);
  await h.store.load();
  // Another device adds a page and a pin.
  h.disk.data = {
    ...ENDED,
    pages: [{ id: "page-a", name: "Reading", scope: { kind: "tag", tag: "reading" } }],
    marks: { ...ENDED.marks, pinned: ["Pinned.md"] },
  };
  assert.equal(await h.store.reload(), true);
  assert.deepEqual(h.store.settings.pages.map((p) => p.name), ["Reading"]);
  assert.deepEqual(h.store.settings.marks.pinned, ["Pinned.md"]);
  assert.equal(h.reloads.length, 1);
  // Quitting writes nothing, so the other device's settings stay on disk.
  assert.equal(await h.store.write(), false);
  assert.equal(h.saves.length, 0);
});

test("an edit pending here wins over settings that arrive by sync", async () => {
  const h = harness({});
  await h.store.load();
  h.store.settings.greetingName = "Les";
  h.store.touch();
  h.disk.data = { greetingName: "Other device" };
  assert.equal(await h.store.reload(), false);
  assert.equal(h.store.settings.greetingName, "Les");
  h.fire();
  await Promise.resolve();
  assert.equal(h.saves[h.saves.length - 1]?.greetingName, "Les");
  assert.equal(h.store.pending, false);
});

test("the next real save carries the housekeeping", async () => {
  const h = harness(ENDED);
  await h.store.load();
  h.store.settings.dedupe = false;
  await h.store.commit();
  assert.equal(h.saves.length, 1);
  assert.deepEqual(h.saves[0].marks.snoozed, {});
});

test("a failed save keeps the edit pending for the next attempt", async () => {
  let fail = true;
  const errors: string[] = [];
  const store = new SettingsStore({
    storage: {
      load: () => Promise.resolve({}),
      save: () => (fail ? Promise.reject(new Error("disk full")) : Promise.resolve()),
    },
    debounce: () => Object.assign(() => undefined, { cancel: () => undefined }),
    onError: (message) => errors.push(message),
  });
  await store.load();
  await store.commit();
  assert.equal(store.pending, true);
  assert.equal(errors.length, 1);
  fail = false;
  assert.equal(await store.write(), true);
  assert.equal(store.pending, false);
});

test("a new install has no stored settings", async () => {
  const h = harness(null);
  assert.equal(await h.store.load(), false);
});
