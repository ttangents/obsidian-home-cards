import assert from "node:assert/strict";
import { test } from "vitest";
import { ActivityLog, EVENT_LIMIT, parseStored, VISIT_GAP_MS, type OpenEvent } from "../src/compose/activity";
import { continueWorking } from "../src/compose/continue";
import { relatedToRecent } from "../src/compose/related";
import { sessionsFrom } from "../src/compose/sessions";
import { VaultSnapshot } from "../src/compose/vault";
import { fakeVault } from "./fake-vault";

const MIN = 60_000;
const DAY = 86_400_000;

function memoryStore() {
  const data = new Map<string, unknown>();
  return {
    data,
    loadLocalStorage: (k: string) => data.get(k) ?? null,
    saveLocalStorage: (k: string, v: unknown) => void data.set(k, JSON.parse(JSON.stringify(v))),
  };
}

test("opens are logged newest first; a quick reopen of the same note is one open", () => {
  let t = 1_000_000_000_000;
  const log = new ActivityLog(memoryStore(), () => t);
  log.record("a.md");
  t += MIN;
  log.record("a.md");
  t += MIN;
  log.record("b.md");
  t += 5 * MIN;
  log.record("a.md");
  assert.deepEqual(log.events().map((e) => e.path), ["a.md", "b.md", "a.md"]);
  assert.equal(log.events()[2].at, 1_000_000_000_000 + MIN, "the reopen retimed the open");
});

test("visits count opens half an hour apart as separate visits", () => {
  let t = 1_000_000_000_000;
  const log = new ActivityLog(memoryStore(), () => t);
  log.record("a.md");
  t += 10 * MIN;
  log.record("b.md");
  t += 10 * MIN;
  log.record("a.md");
  assert.equal(log.visits().get("a.md")?.count, 1);
  t += VISIT_GAP_MS;
  log.record("a.md");
  assert.deepEqual(log.visits().get("a.md"), { count: 2, last: t });
});

test("the log keeps 30 days and a bounded number of opens", () => {
  let t = 1_000_000_000_000;
  const log = new ActivityLog(memoryStore(), () => t);
  log.record("old.md");
  t += 31 * DAY;
  log.record("new.md");
  assert.deepEqual(log.events().map((e) => e.path), ["new.md"]);
  assert.equal(log.visits().get("old.md")?.count, 1, "visits outlive the open log");
  for (let i = 0; i < EVENT_LIMIT + 20; i++) {
    t += 3 * MIN;
    log.record(`${i}.md`);
  }
  assert.equal(log.events().length, EVENT_LIMIT);
});

test("activity follows renames, merges visits on collision, and forgets deletions", () => {
  let t = 1_000_000_000_000;
  const log = new ActivityLog(memoryStore(), () => t);
  log.record("Work/a.md");
  t += 40 * MIN;
  log.record("b.md");
  t += 40 * MIN;
  log.record("Work/a.md");
  log.rename("Work", "Jobs");
  assert.deepEqual(log.events().map((e) => e.path), ["Jobs/a.md", "b.md", "Jobs/a.md"]);
  assert.equal(log.visits().get("Jobs/a.md")?.count, 2);
  log.rename("b.md", "Jobs/a.md");
  assert.equal(log.visits().get("Jobs/a.md")?.count, 3);
  log.forget("Jobs");
  assert.equal(log.events().length, 0);
  assert.equal(log.visits().size, 0);
});

test("activity saves on flush and reads back; malformed storage reads as none", () => {
  const store = memoryStore();
  let t = 1_000_000_000_000;
  const log = new ActivityLog(store, () => t);
  log.record("a.md");
  assert.equal(store.data.size, 0, "nothing is written before a flush");
  log.flush();
  const again = new ActivityLog(store, () => t);
  assert.deepEqual(again.events(), [{ path: "a.md", at: t }]);
  assert.deepEqual(again.visits().get("a.md"), { count: 1, last: t });
  for (const junk of [null, "x", { v: 99, e: [["a", 1]] }, { v: 1, e: [[4, "x"]], s: { a: ["x", 1] } }]) {
    const parsed = parseStored(junk);
    assert.equal(parsed.log.length + parsed.stats.size, 0);
  }
});

const ev = (path: string, minutesAgo: number, now: number): OpenEvent => ({ path, at: now - minutesAgo * MIN });

test("a gap of more than 45 minutes starts a new session", () => {
  const now = 1_000_000_000_000;
  const events = [ev("c.md", 0, now), ev("b.md", 20, now), ev("c.md", 40, now), ev("a.md", 100, now), ev("z.md", 130, now)];
  const sessions = sessionsFrom(events);
  assert.equal(sessions.length, 2);
  assert.deepEqual(sessions[0].notes.map((n) => n.path), ["c.md", "b.md"]);
  assert.equal(sessions[0].notes[0].at, now);
  assert.equal(sessions[0].start, now - 40 * MIN);
  assert.deepEqual(sessions[1].notes.map((n) => n.path), ["a.md", "z.md"]);
  assert.deepEqual(sessionsFrom([]), []);
});

const NOW = new Date(2026, 9, 17, 14, 30);
const T = NOW.getTime();
const v = fakeVault(
  [
    { path: "Agent control planes.md", mtime: T - 10 * MIN, tags: ["acp"] },
    { path: "AWS notes.md", mtime: T - 3 * DAY, tags: ["acp", "vendor"] },
    { path: "Vendor scorecard.md", mtime: T - 25 * MIN },
    { path: "Yesterday.md", mtime: T - DAY },
    { path: "Neighbour.md", mtime: T - 9 * DAY },
    { path: "Shared.md", mtime: T - 9 * DAY },
    { path: "Tagged twice.md", mtime: T - 9 * DAY, tags: ["acp", "vendor"] },
    { path: "Tagged once.md", mtime: T - 9 * DAY, tags: ["vendor"] },
    { path: "Hub.md", mtime: T - 9 * DAY },
    ...Array.from({ length: 60 }, (_, i) => ({ path: `Spoke ${i}.md`, mtime: T - 9 * DAY })),
  ],
  {
    links: {
      "Agent control planes.md": { "Neighbour.md": 1, "Hub.md": 1, "Shared.md": 1 },
      "AWS notes.md": { "Agent control planes.md": 2 },
      "Vendor scorecard.md": { "Shared.md": 1 },
      "Hub.md": Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`Spoke ${i}.md`, 1])),
    },
  }
);
const activity = {
  events: () => [
    ev("Agent control planes.md", 43, T),
    ev("AWS notes.md", 60, T),
    ev("Yesterday.md", 24 * 60, T),
  ],
  visits: () => new Map(),
};
const snap = () => new VaultSnapshot(v.app, NOW, [], null, activity);

test("Continue working lists the latest session, its edits, then the session before", () => {
  const ranked = continueWorking(snap(), snap().files);
  assert.deepEqual(
    ranked.slice(0, 4).map((r) => [r.file.path, r.lead]),
    [
      ["Agent control planes.md", "Opened 43 minutes ago"],
      ["AWS notes.md", "Opened in the same session"],
      ["Vendor scorecard.md", "Edited during that session"],
      ["Yesterday.md", "From a session yesterday"],
    ]
  );
  assert.deepEqual(continueWorking(new VaultSnapshot(v.app, NOW), []), [], "no activity, no section");
});

test("Related ranks direct links, shared neighbours and shared tags, and explains each", () => {
  const ranked = relatedToRecent(snap(), snap().files);
  const lead = (p: string) => ranked.find((r) => r.file.path === p)?.lead;
  const paths = ranked.map((r) => r.file.path);
  assert.ok(!paths.includes("Agent control planes.md") && !paths.includes("AWS notes.md"), "seeds are left out");
  assert.equal(lead("Neighbour.md"), "Linked from Agent control planes");
  assert.equal(lead("Vendor scorecard.md"), "1 shared link with Agent control planes");
  assert.equal(lead("Tagged twice.md"), "Shares #acp with AWS notes", "the strongest reason names its note");
  assert.ok(!paths.includes("Tagged once.md"), "one shared tag with one seed scores below the bar");
  assert.ok(!paths.some((p) => p.startsWith("Spoke")), "a busy hub's other links say nothing");
  assert.ok(paths.indexOf("Neighbour.md") < paths.indexOf("Tagged twice.md"), "a link outranks shared tags");
});
