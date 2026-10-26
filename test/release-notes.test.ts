import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import { normalizeSettings } from "../src/settings/normalize";
import {
  announcementTitle,
  checkForUpdate,
  compareVersions,
  laterVersion,
  notesSince,
  parseVersion,
  recentNotes,
  RELEASE_GROUPS,
  RELEASE_NOTES,
  type ReleaseNote,
  type UpdateCheck,
} from "../src/settings/release-notes";

const note = (version: string, announce = true): ReleaseNote => ({
  version,
  date: "2026-01-01",
  headline: `Release ${version}.`,
  announce,
  new: ["Something."],
});
/** Newest first, as RELEASE_NOTES is. 1.3.1 is a quiet fix. */
const NOTES = [note("1.4.0"), note("1.3.1", false), note("1.3.0"), note("1.2.0"), note("1.1.0")];
const check = (over: Partial<UpdateCheck>): UpdateCheck => ({
  current: "1.4.0",
  seen: "1.2.0",
  firstRun: false,
  enabled: true,
  ...over,
});
const versions = (d: ReturnType<typeof checkForUpdate>) => (d.kind === "announce" ? d.notes.map((n) => n.version) : d.kind);

// ------------------------------------------------------------- versions

test("versions compare by number, not by text", () => {
  assert.ok(compareVersions("1.10.0", "1.9.0") > 0);
  assert.ok(compareVersions("1.9.3", "1.10.0") < 0);
  assert.equal(compareVersions("2.0.0", "2.0.0"), 0);
  assert.equal(parseVersion("1.2"), null);
  assert.equal(parseVersion("v1.2.3"), null);
  assert.deepEqual(parseVersion(" 1.2.3 "), [1, 2, 3]);
});

test("a version that does not parse is older than any that does", () => {
  assert.ok(compareVersions("", "0.0.1") < 0);
  assert.ok(compareVersions("1.0.0", "junk") > 0);
  assert.equal(compareVersions("junk", ""), 0);
});

test("the later marker wins, and garbage reads as no marker", () => {
  assert.equal(laterVersion("1.31.0", "1.32.0"), "1.32.0");
  assert.equal(laterVersion("1.32.0", "1.4.0"), "1.32.0");
  assert.equal(laterVersion("1.32.0", ""), "1.32.0");
  assert.equal(laterVersion("nonsense", ""), "");
  assert.equal(laterVersion("", ""), "");
});

// ------------------------------------------------------------------ notes

test("the notes since a version run up to the current one, newest first", () => {
  assert.deepEqual(notesSince("1.2.0", "1.4.0", NOTES).map((n) => n.version), ["1.4.0", "1.3.1", "1.3.0"]);
  assert.deepEqual(notesSince("1.3.0", "1.3.1", NOTES).map((n) => n.version), ["1.3.1"]);
  // A marker between releases, or one with no notes of its own, still works.
  assert.deepEqual(notesSince("1.2.5", "1.3.0", NOTES).map((n) => n.version), ["1.3.0"]);
});

test("What's new by hand shows the latest releases, none newer than the installed one", () => {
  assert.deepEqual(recentNotes("1.3.1", NOTES).map((n) => n.version), ["1.3.1", "1.3.0", "1.2.0", "1.1.0"]);
  assert.equal(recentNotes("9.9.9").length, Math.min(5, RELEASE_NOTES.length));
});

// --------------------------------------------------------------- decision

test("an update announces every release the reader has not seen", () => {
  assert.deepEqual(versions(checkForUpdate(check({}), NOTES)), ["1.4.0", "1.3.1", "1.3.0"]);
});

test("a new install records its version and announces nothing", () => {
  assert.equal(versions(checkForUpdate(check({ firstRun: true, seen: "" }), NOTES)), "record");
});

test("the same version, or a downgrade, leaves the marker alone", () => {
  assert.equal(versions(checkForUpdate(check({ seen: "1.4.0" }), NOTES)), "none");
  assert.equal(versions(checkForUpdate(check({ current: "1.3.0", seen: "1.4.0" }), NOTES)), "none");
});

test("with announcements off, the marker still advances", () => {
  assert.equal(versions(checkForUpdate(check({ enabled: false }), NOTES)), "record");
});

test("quiet releases alone advance the marker without a notice", () => {
  assert.equal(versions(checkForUpdate(check({ current: "1.3.1", seen: "1.3.0" }), NOTES)), "record");
  // A quiet release on top of an unseen announced one still announces both.
  assert.deepEqual(versions(checkForUpdate(check({ current: "1.3.1", seen: "1.2.0" }), NOTES)), ["1.3.1", "1.3.0"]);
});

test("settings from before the marker announce only the current release", () => {
  assert.deepEqual(versions(checkForUpdate(check({ seen: "" }), NOTES)), ["1.4.0"]);
  assert.equal(versions(checkForUpdate(check({ current: "1.3.1", seen: "" }), NOTES)), "record");
});

test("an installed version that does not parse decides nothing", () => {
  assert.equal(versions(checkForUpdate(check({ current: "dev" }), NOTES)), "none");
});

test("the notice names the newest release and counts the rest", () => {
  assert.equal(announcementTitle([note("1.4.0")]), "Home Cards 1.4.0");
  assert.equal(announcementTitle(NOTES.slice(0, 2)), "Home Cards 1.4.0, with 1 earlier release");
  assert.equal(announcementTitle(NOTES.slice(0, 3)), "Home Cards 1.4.0, with 2 earlier releases");
  assert.equal(announcementTitle([]), "");
});

// ---------------------------------------------------------------- storage

test("settings keep the marker and the switch, and drop a marker that is not a version", () => {
  const s = normalizeSettings({ lastShownVersion: "1.31.0", showReleaseNotes: false });
  assert.equal(s.lastShownVersion, "1.31.0");
  assert.equal(s.showReleaseNotes, false);
  assert.equal(normalizeSettings({ lastShownVersion: "<b>1</b>" }).lastShownVersion, "");
  assert.equal(normalizeSettings({ lastShownVersion: 132 }).lastShownVersion, "");
  const d = normalizeSettings({});
  assert.equal(d.lastShownVersion, "");
  assert.equal(d.showReleaseNotes, true);
});

// ------------------------------------------------------------ the notes

test("the newest release note is the version in the manifest", () => {
  const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as { version: string };
  assert.equal(RELEASE_NOTES[0]?.version, manifest.version);
});

test("every published version has release notes", () => {
  const published = Object.keys(JSON.parse(readFileSync("versions.json", "utf8")) as Record<string, string>);
  const noted = new Set(RELEASE_NOTES.map((n) => n.version));
  for (const v of published) assert.ok(noted.has(v), `no release notes for ${v}`);
});

test("release notes run newest first, with dates, headlines and items", () => {
  for (const [i, n] of RELEASE_NOTES.entries()) {
    assert.ok(parseVersion(n.version), `${n.version} is a version`);
    assert.match(n.date, /^\d{4}-\d{2}-\d{2}$/, `${n.version} date`);
    assert.ok(n.headline.trim().endsWith("."), `${n.version} headline is a sentence`);
    const items = [...RELEASE_GROUPS.flatMap((g) => n[g.key] ?? []), ...(n.worksWith?.items ?? [])];
    if (n.worksWith) assert.match(n.worksWith.url, /^https:\/\/community\.obsidian\.md\/plugins\//, `${n.version} links to the directory`);
    assert.ok(items.length > 0, `${n.version} lists a change`);
    for (const item of items) assert.ok(/[.)"]$/.test(item.trim()), `${n.version}: "${item}" ends a sentence`);
    const next = RELEASE_NOTES[i + 1];
    if (next) {
      assert.ok(compareVersions(n.version, next.version) > 0, `${n.version} before ${next.version}`);
      assert.ok(n.date >= next.date, `${n.version} dated no earlier than ${next.version}`);
    }
  }
});
