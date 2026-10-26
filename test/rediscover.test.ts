import assert from "node:assert/strict";
import { test } from "vitest";
import { rediscover, dailyShuffle, HUB_DEGREE } from "../src/compose/rediscover";
import { VaultSnapshot } from "../src/compose/vault";
import { blankSection, defaultSettings, type RediscoverStrategy } from "../src/settings/schema";
import { fakeVault } from "./fake-vault";

const NOW = new Date(2026, 9, 17, 14, 30);
const DAY = 86_400_000;
const T = NOW.getTime();
const old = T - 400 * DAY;

const hubLinks = Object.fromEntries(Array.from({ length: HUB_DEGREE }, (_, i) => [`Leaf ${i}.md`, 1]));
const v = fakeVault(
  [
    { path: "Gem.md", mtime: old, size: 9000 },
    { path: "Lesser gem.md", mtime: old, size: 9000 },
    { path: "Stub.md", mtime: old, size: 300 },
    { path: "Hub.md", mtime: old, size: 9000 },
    { path: "Fresh.md", mtime: T - DAY, size: 9000 },
    { path: "Birthday.md", ctime: new Date(2023, 9, 18, 9).getTime(), mtime: T - 5 * DAY, size: 9000 },
    { path: "New year.md", ctime: new Date(2024, 0, 1).getTime(), mtime: T - 5 * DAY, size: 9000 },
    { path: "Friend.md", mtime: T - 2 * DAY, size: 9000 },
    { path: "Acquaintance.md", mtime: T - 2 * DAY, size: 9000 },
    ...Array.from({ length: HUB_DEGREE }, (_, i) => ({ path: `Leaf ${i}.md`, mtime: T - DAY, size: 9000 })),
  ],
  {
    links: {
      "Fresh.md": { "Gem.md": 1, "Lesser gem.md": 1 },
      "Friend.md": { "Gem.md": 1 },
      "Acquaintance.md": { "Gem.md": 1, "Lesser gem.md": 1 },
      "Hub.md": hubLinks,
    },
  }
);
const visits = new Map([
  ["Friend.md", { count: 12, last: T - 60 * DAY }],
  ["Acquaintance.md", { count: 2, last: T - 60 * DAY }],
  ["Hub.md", { count: 9, last: T - 200 * DAY }],
]);
const snap = new VaultSnapshot(v.app, NOW, [], null, { events: () => [], visits: () => visits });
const run = (strategy: RediscoverStrategy) =>
  rediscover(snap, snap.files, blankSection({ id: "r", kind: "rediscover", strategy }), { ...defaultSettings(), rediscoverMonths: 6 });

test("Forgotten notes are the untouched ones, in an order that holds for the day", () => {
  const paths = run("forgotten").map((r) => r.file.path).sort();
  assert.deepEqual(paths, ["Gem.md", "Hub.md", "Lesser gem.md", "Stub.md"]);
  assert.match(run("forgotten")[0].lead ?? "", /^Untouched for 13 months$/);
  const items = Array.from({ length: 20 }, (_, i) => i);
  assert.deepEqual(dailyShuffle(items, NOW, "s"), dailyShuffle(items, new Date(2026, 9, 17, 23, 0), "s"));
  assert.notDeepEqual(dailyShuffle(items, NOW, "s"), dailyShuffle(items, new Date(2026, 9, 18, 9, 0), "s"));
});

test("Forgotten gems are untouched notes others still link to, the most linked first", () => {
  assert.deepEqual(
    run("gems").map((r) => [r.file.path, r.lead]),
    [
      ["Gem.md", "3 backlinks, untouched for 13 months"],
      ["Lesser gem.md", "2 backlinks, untouched for 13 months"],
    ]
  );
});

test("Unfinished thoughts are short, barely linked and untouched", () => {
  assert.deepEqual(run("unfinished").map((r) => [r.file.path, r.lead]), [["Stub.md", "Short and unlinked"]]);
});

test("On this day finds notes from this week of earlier years, across the new year too", () => {
  const ranked = run("on-this-day");
  assert.deepEqual(ranked.map((r) => [r.file.path, r.lead]), [["Birthday.md", "Created 3 years ago this week"]]);
  const winter = new VaultSnapshot(v.app, new Date(2026, 11, 30, 10), [], null);
  const lead = rediscover(winter, winter.files, blankSection({ id: "r", kind: "rediscover", strategy: "on-this-day" }), defaultSettings())
    .find((r) => r.file.path === "New year.md")?.lead;
  assert.equal(lead, "Created 2 years ago this week");
});

test("Sleeping hubs have many links and no recent visit", () => {
  assert.deepEqual(run("hubs").map((r) => [r.file.path, r.lead]), [["Hub.md", `${HUB_DEGREE} connections, untouched for 13 months`]]);
});

test("Old friends were opened often and not for a while", () => {
  const ranked = run("old-friends");
  assert.deepEqual(ranked.map((r) => r.file.path), ["Friend.md", "Hub.md"]);
  assert.match(ranked[0].lead ?? "", /^Opened 12 times, last on /);
});
