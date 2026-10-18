/**
 * What Home Cards observes of the reader's activity: which notes were
 * opened, and when. Continue working, Related notes and Old friends read
 * from it.
 *
 * Two bounded records, kept per device in Obsidian's local storage,
 * outside the synced settings, as the open history is:
 *
 * - recent opens, newest first, for the last 30 days and at most 500, from
 *   which work sessions are derived when needed (see sessions.ts);
 * - visits per note: how many times it was opened, counting opens closer
 *   together than half an hour as one visit, and when it was last opened.
 *
 * Nothing here is derived data that could be recomputed from the vault:
 * Obsidian keeps no history of opens beyond its last ten files, so these
 * observations exist only if Home Cards keeps them.
 *
 * Pure apart from the injected store, so the tests drive it directly.
 */

import type { LocalStore } from "./open-history";

const STORE_KEY = "home-cards-activity";
const VERSION = 1;

/** Opens kept, at most, and for at most this long. */
export const EVENT_LIMIT = 500;
export const EVENT_DAYS = 30;
/** Notes whose visits are kept; the least recently opened go first. */
export const VISIT_LIMIT = 2000;
/** Opens of one note closer together than this are one visit. */
export const VISIT_GAP_MS = 30 * 60_000;
/** A reopen of the newest note within this is the same open, retimed. */
const REOPEN_MS = 2 * 60_000;

export interface OpenEvent {
  path: string;
  /** Epoch milliseconds. */
  at: number;
}

export interface Visits {
  count: number;
  /** Epoch milliseconds of the latest open. */
  last: number;
}

/** The read side, as the vault snapshot hands it to ranking. */
export interface ActivityFacts {
  /** Opens, newest first. */
  events(): readonly OpenEvent[];
  visits(): ReadonlyMap<string, Visits>;
}

interface Stored {
  v: number;
  e: [string, number][];
  s: Record<string, [number, number]>;
}

export class ActivityLog implements ActivityFacts {
  private log: OpenEvent[] | null = null;
  private stats: Map<string, Visits> | null = null;
  private dirty = false;

  constructor(
    private readonly store: LocalStore,
    private readonly clock: () => number = Date.now
  ) {}

  events(): readonly OpenEvent[] {
    return this.load().log;
  }

  visits(): ReadonlyMap<string, Visits> {
    return this.load().stats;
  }

  /** Note that `path` was opened now. */
  record(path: string): void {
    const { log, stats } = this.load();
    const now = this.clock();
    const newest = log[0];
    if (newest && newest.path === path && now - newest.at < REOPEN_MS) {
      newest.at = now;
    } else {
      log.unshift({ path, at: now });
    }
    const v = stats.get(path);
    if (!v) stats.set(path, { count: 1, last: now });
    else {
      if (now - v.last >= VISIT_GAP_MS) v.count++;
      v.last = now;
    }
    this.trim(now);
    this.dirty = true;
  }

  /** Follow a rename of a note, or of a folder and everything in it. */
  rename(from: string, to: string): void {
    const { log, stats } = this.load();
    const moved = (p: string) => (p === from ? to : p.startsWith(`${from}/`) ? to + p.slice(from.length) : p);
    let changed = false;
    for (const e of log) {
      const next = moved(e.path);
      if (next !== e.path) {
        e.path = next;
        changed = true;
      }
    }
    for (const [path, v] of [...stats]) {
      const next = moved(path);
      if (next === path) continue;
      stats.delete(path);
      const merged = stats.get(next);
      stats.set(next, merged ? { count: merged.count + v.count, last: Math.max(merged.last, v.last) } : v);
      changed = true;
    }
    if (changed) this.dirty = true;
  }

  /** Forget a deleted note, or everything under a deleted folder. */
  forget(path: string): void {
    const { log, stats } = this.load();
    const gone = (p: string) => p === path || p.startsWith(`${path}/`);
    const before = log.length + stats.size;
    this.log = log.filter((e) => !gone(e.path));
    for (const p of [...stats.keys()]) if (gone(p)) stats.delete(p);
    if (this.log.length + stats.size !== before) this.dirty = true;
  }

  /** Write pending changes. The plugin calls this once the opens settle. */
  flush(): void {
    if (!this.dirty || !this.log || !this.stats) return;
    this.dirty = false;
    const data: Stored = {
      v: VERSION,
      e: this.log.map((e) => [e.path, e.at]),
      s: Object.fromEntries([...this.stats].map(([p, v]) => [p, [v.count, v.last]])),
    };
    try {
      this.store.saveLocalStorage(STORE_KEY, data);
    } catch (err) {
      this.dirty = true;
      console.error("Home Cards: could not save activity", err);
    }
  }

  private trim(now: number): void {
    const log = this.log ?? [];
    const cutoff = now - EVENT_DAYS * 86_400_000;
    let keep = Math.min(log.length, EVENT_LIMIT);
    while (keep > 0 && log[keep - 1].at < cutoff) keep--;
    log.length = keep;
    const stats = this.stats ?? new Map<string, Visits>();
    if (stats.size > VISIT_LIMIT) {
      const oldest = [...stats].sort((a, b) => a[1].last - b[1].last).slice(0, stats.size - VISIT_LIMIT);
      for (const [p] of oldest) stats.delete(p);
    }
  }

  private load(): { log: OpenEvent[]; stats: Map<string, Visits> } {
    if (this.log && this.stats) return { log: this.log, stats: this.stats };
    let stored: unknown = null;
    try {
      stored = this.store.loadLocalStorage(STORE_KEY);
    } catch (err) {
      console.error("Home Cards: could not read activity", err);
    }
    const { log, stats } = parseStored(stored);
    this.log = log;
    this.stats = stats;
    return { log, stats };
  }
}

/** Read stored activity, keeping only well-formed entries; anything else is no activity. */
export function parseStored(raw: unknown): { log: OpenEvent[]; stats: Map<string, Visits> } {
  const log: OpenEvent[] = [];
  const stats = new Map<string, Visits>();
  if (typeof raw !== "object" || raw === null) return { log, stats };
  const data = raw as Partial<Stored>;
  if (data.v !== VERSION) return { log, stats };
  for (const entry of Array.isArray(data.e) ? data.e : []) {
    if (Array.isArray(entry) && typeof entry[0] === "string" && Number.isFinite(entry[1])) {
      log.push({ path: entry[0], at: entry[1] });
    }
    if (log.length >= EVENT_LIMIT) break;
  }
  log.sort((a, b) => b.at - a.at);
  if (typeof data.s === "object" && data.s !== null) {
    for (const [path, v] of Object.entries(data.s)) {
      if (Array.isArray(v) && Number.isInteger(v[0]) && v[0] > 0 && Number.isFinite(v[1])) {
        stats.set(path, { count: v[0], last: v[1] });
      }
    }
  }
  return { log, stats };
}
