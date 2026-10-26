/**
 * The settings store: when edits are written and when settings that sync
 * brings from another device replace the ones in memory.
 */

import assert from "node:assert/strict";
import { setImmediate as settled } from "node:timers/promises";
import { test } from "vitest";
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

test("a reload waits while an editor holds the settings, then replaces them", async () => {
  const h = harness({ pages: [{ id: "page-a", name: "Reading", scope: { kind: "all" } }] });
  await h.store.load();
  const page = h.store.settings.pages[0];
  const release = h.store.hold();
  const inner = h.store.hold();
  h.disk.data = { pages: [{ id: "page-b", name: "Work", scope: { kind: "all" } }] };
  assert.equal(await h.store.reload(), false);
  assert.equal(h.store.settings.pages[0], page, "the editor's record is still in the settings");
  inner();
  inner();
  assert.equal(h.reloads.length, 0, "another editor is still open");
  release();
  await settled();
  assert.deepEqual(h.store.settings.pages.map((p) => p.name), ["Work"]);
  assert.equal(h.reloads.length, 1);
});

test("an editor that closes with an edit pending keeps its edit over a waiting reload", async () => {
  const h = harness({});
  await h.store.load();
  const release = h.store.hold();
  h.disk.data = { greetingName: "Other device" };
  await h.store.reload();
  h.store.settings.greetingName = "Les";
  h.store.touch();
  release();
  await settled();
  assert.equal(h.store.settings.greetingName, "Les");
  assert.equal(h.reloads.length, 0);
  h.fire();
  await Promise.resolve();
  assert.equal(h.saves[h.saves.length - 1]?.greetingName, "Les");
});

test("settings from a newer Home Cards load read-only and are never written", async () => {
  const { SETTINGS_VERSION } = await import("../src/settings/schema");
  const newer = { version: SETTINGS_VERSION + 1, greetingName: "Les", futureKey: { kept: true } };
  const told: string[] = [];
  const disk = { data: newer as unknown };
  const saves: unknown[] = [];
  const store = new SettingsStore({
    storage: {
      load: () => Promise.resolve(structuredClone(disk.data)),
      save: (settings) => {
        saves.push(settings);
        return Promise.resolve();
      },
    },
    debounce: () => Object.assign(() => undefined, { cancel: () => undefined }),
    onNewer: () => told.push("newer"),
  });
  await store.load();
  assert.equal(store.readOnly, true);
  assert.equal(store.settings.greetingName, "Les");
  assert.deepEqual(told, ["newer"]);

  store.settings.greetingName = "Changed here";
  await store.commit();
  assert.equal(await store.write(), false);
  assert.equal(saves.length, 0, "the newer build's settings stay on disk");

  // Settings that sync brings replace these even with an edit in memory.
  store.touch();
  disk.data = { ...newer, greetingName: "Other device" };
  assert.equal(await store.reload(), true);
  assert.equal(store.settings.greetingName, "Other device");
  assert.deepEqual(told, ["newer"], "the reader hears once");

  // Once this device's Home Cards catches up, it writes again.
  disk.data = { version: SETTINGS_VERSION };
  await store.reload();
  assert.equal(store.readOnly, false);
  await store.commit();
  assert.equal(saves.length, 1);
});

test("settings without a version, or with this build's, load for writing", async () => {
  const { storedVersion } = await import("../src/settings/store");
  assert.equal(storedVersion({}), 0);
  assert.equal(storedVersion({ version: "9" }), 0);
  assert.equal(storedVersion(null), 0);
  assert.equal(storedVersion({ version: 2 }), 2);
  const h = harness({ version: 2 });
  await h.store.load();
  assert.equal(h.store.readOnly, false);
});

test("an editor that closes while its edit is being written keeps that edit", async () => {
  let land: () => void = () => undefined;
  const disk = { data: {} as unknown };
  const store = new SettingsStore({
    storage: {
      load: () => Promise.resolve(structuredClone(disk.data)),
      save: (settings) =>
        new Promise<void>((resolve) => {
          land = () => {
            disk.data = structuredClone(settings);
            resolve();
          };
        }),
    },
    debounce: () => Object.assign(() => undefined, { cancel: () => undefined }),
  });
  await store.load();
  const release = store.hold();
  disk.data = { greetingName: "Other device" };
  await store.reload();
  store.settings.greetingName = "Les";
  store.touch();
  const flushing = store.flush();
  release();
  await settled();
  assert.equal(store.settings.greetingName, "Les", "the waiting reload gives way to the edit being written");
  land();
  await flushing;
  assert.deepEqual((disk.data as { greetingName: string }).greetingName, "Les");
});
