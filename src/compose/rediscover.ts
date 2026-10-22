/**
 * Rediscover: resurfacing notes the reader has drifted away from. Each
 * strategy is a plain rule over facts Home Cards already has: dates from
 * the file system, links from the metadata cache, and opens from the
 * activity log. Each card's footer names the fact that chose it.
 *
 * Where a strategy shuffles, the order is seeded on the date: it holds for
 * the whole day, so the section stays still while notes are edited and
 * the page recomposes, and it changes the next day.
 *
 * Pure: reads only the vault snapshot it is given.
 */

import type { TFile } from "obsidian";
import type { HomeCardsSettings, SectionConfig } from "../settings/schema";
import { relativeDay, spanSince } from "./projection";
import type { Ranked } from "./rank";
import type { VaultSnapshot } from "./vault";
import { recentSeeds } from "./related";
import { noteName } from "../settings/folders";

const DAY_MS = 86_400_000;

/** At most this size, in bytes, a note counts as short. */
export const SHORT_NOTE_BYTES = 1200;
/** At least this many distinct links in and out make a hub. */
export const HUB_DEGREE = 10;
/** A hub or friend opened more recently than this is not asleep. */
const RECENT_VISIT_DAYS = 60;
/** Old friends: opened at least this often, and not for this many days. */
export const FRIEND_VISITS = 4;
export const FRIEND_ABSENT_DAYS = 45;
/** On this day: within this many days of today's date, in an earlier year. */
const ON_THIS_DAY_SPAN = 3;

/** Notes untouched for `months` or more: the pool most strategies draw from. */
export function forgottenNotes(files: readonly TFile[], now: Date, months: number): TFile[] {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return files.filter((f) => f.stat.mtime < cutoff.getTime());
}

/** A small seeded generator (mulberry32), so a shuffle can repeat. */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A copy of `items` in an order fixed for the local day and the salt. */
export function dailyShuffle<T>(items: readonly T[], now: Date, salt: string): T[] {
  const day = Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / DAY_MS);
  const rng = seeded(`${day}/${salt}`);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Days between two dates' places in the calendar, ignoring the year, so
 * 30 December and 2 January are three days apart.
 */
function calendarDistance(a: Date, b: Date): number {
  const dayOf = (d: Date) => Date.UTC(2001, d.getMonth(), d.getDate()) / DAY_MS;
  const diff = Math.abs(dayOf(a) - dayOf(b));
  return Math.min(diff, 365 - diff);
}

function onThisDay(vault: VaultSnapshot, pool: readonly TFile[]): Ranked[] {
  const now = vault.now;
  const hits: { file: TFile; distance: number; at: number; lead: string }[] = [];
  for (const file of pool) {
    for (const [at, verb] of [
      [file.stat.ctime, "Created"],
      [file.stat.mtime, "Last edited"],
    ] as const) {
      const d = new Date(at);
      const years = now.getFullYear() - d.getFullYear();
      if (years < 1) continue;
      const distance = calendarDistance(d, now);
      if (distance > ON_THIS_DAY_SPAN) continue;
      const when = distance === 0 ? "today" : "this week";
      hits.push({ file, distance, at, lead: `${verb} ${plural(years, "year", "years")} ago ${when}` });
      break;
    }
  }
  return hits
    .sort((a, b) => a.distance - b.distance || a.at - b.at)
    .map(({ file, lead }) => ({ file, lead }));
}

/** The section's notes, best first, by its strategy. */
export function rediscover(
  vault: VaultSnapshot,
  pool: readonly TFile[],
  cfg: SectionConfig,
  settings: HomeCardsSettings
): Ranked[] {
  const now = vault.now;
  const untouched = (f: TFile) => `untouched for ${spanSince(f.stat.mtime, now)}`;
  const forgotten = () => dailyShuffle(forgottenNotes(pool, now, settings.rediscoverMonths), now, cfg.id);
  const visits = vault.activity.visits();
  const lastVisit = (f: TFile) => visits.get(f.path)?.last ?? 0;

  switch (cfg.strategy) {
    case "gems": {
      const backlinks = vault.links().in;
      return forgotten()
        .map((file) => ({ file, n: backlinks.get(file.path)?.size ?? 0 }))
        .filter(({ n }) => n >= 2)
        .sort((a, b) => b.n - a.n)
        .map(({ file, n }) => ({ file, lead: `${plural(n, "backlink", "backlinks")}, ${untouched(file)}` }));
    }
    case "unfinished":
      return forgotten()
        .filter((f) => f.stat.size <= SHORT_NOTE_BYTES && vault.degree(f.path) <= 1)
        .map((file) => ({ file, lead: vault.degree(file.path) ? "Short, with one link" : "Short and unlinked" }));
    case "on-this-day":
      return onThisDay(vault, pool);
    case "hubs": {
      const awake = now.getTime() - RECENT_VISIT_DAYS * DAY_MS;
      return forgotten()
        .map((file) => ({ file, d: vault.degree(file.path) }))
        .filter(({ file, d }) => d >= HUB_DEGREE && lastVisit(file) < awake)
        .sort((a, b) => b.d - a.d)
        .map(({ file, d }) => ({ file, lead: `${plural(d, "connection", "connections")}, ${untouched(file)}` }));
    }
    case "old-friends": {
      const absent = now.getTime() - FRIEND_ABSENT_DAYS * DAY_MS;
      return pool
        .map((file) => ({ file, v: visits.get(file.path) }))
        .filter(({ v }) => v !== undefined && v.count >= FRIEND_VISITS && v.last < absent)
        .sort((a, b) => (b.v?.count ?? 0) - (a.v?.count ?? 0))
        .map(({ file, v }) => ({
          file,
          lead: `Opened ${v?.count ?? 0} times, last on ${relativeDay(new Date(v?.last ?? 0), now)}`,
        }));
    }
    case "unlinked":
      return similarButUnlinked(vault, pool, lastVisit);
    default:
      return forgotten().map((file) => ({
        file,
        lead: `Untouched for ${spanSince(file.stat.mtime, now)}`,
      }));
  }
}

/** Notes close in meaning to each recent note that Relate is asked for. */
const UNLINKED_PER_SEED = 40;

/**
 * Similar but unlinked: notes close in meaning to what the reader opened
 * most recently, with no link either way to that note, and not opened in
 * the last two months. Needs Relate's search by meaning; empty without it.
 */
function similarButUnlinked(vault: VaultSnapshot, pool: readonly TFile[], lastVisit: (f: TFile) => number): Ranked[] {
  const relate = vault.relate;
  if (!relate?.meaningReady()) return [];
  const seeds = recentSeeds(vault);
  const seedSet = new Set(seeds);
  const byPath = new Map(pool.map((f) => [f.path, f]));
  const { out, in: inn } = vault.links();
  const awake = vault.now.getTime() - RECENT_VISIT_DAYS * DAY_MS;
  const best = new Map<string, { score: number; seed: string }>();
  for (const seed of seeds) {
    const linked = new Set([...(out.get(seed) ?? []), ...(inn.get(seed) ?? [])]);
    for (const conn of relate.connections(seed)) linked.add(conn.path);
    for (const hit of relate.similar(seed, UNLINKED_PER_SEED)) {
      const file = byPath.get(hit.path);
      if (!file || seedSet.has(hit.path) || linked.has(hit.path) || lastVisit(file) >= awake) continue;
      const prev = best.get(hit.path);
      if (!prev || hit.score > prev.score) best.set(hit.path, { score: hit.score, seed });
    }
  }
  return [...best]
    .sort((a, b) => b[1].score - a[1].score)
    .flatMap(([path, { seed }]) => {
      const file = byPath.get(path);
      return file ? [{ file, lead: `Close in meaning to ${noteName(seed)}, not linked` }] : [];
    });
}
