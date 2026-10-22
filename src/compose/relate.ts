/**
 * Relate, when it is installed: what Home Cards reads from it, and nothing
 * more. Relate is another plugin that keeps typed, two-way relationships
 * between notes in ordinary properties and can search by meaning. Home
 * Cards works without it in every respect; with it, a few sources gain
 * relationships, chains of links and closeness in meaning.
 *
 * Home Cards never reaches into Relate. Relate hands over its documented
 * API through public workspace events (see main.ts), and this module
 * checks the shape of what arrives before anything uses it. A Relate whose
 * contract version Home Cards does not know counts as absent.
 *
 * Pure: types and checks, no Obsidian runtime.
 */

import { noteName } from "../settings/folders";

/** The contract version Home Cards was written against. */
export const RELATE_CONTRACT = 1;

/** Workspace events in Relate's contract. */
export const RELATE_EVENTS = {
  ready: "relate:ready",
  request: "relate:request",
  changed: "relate:changed",
  unload: "relate:unload",
} as const;

/** One step of a chain of links: `from` lists `to` under `prop`. */
export interface RelateStep {
  from: string;
  prop: string;
  to: string;
}

export interface RelateHit {
  path: string;
  reasons: string[];
  /** Chains of links from the result to the note the query named; may be empty. */
  paths: RelateStep[][];
}

/** The part of Relate's API Home Cards uses. */
export interface RelateApi {
  readonly version: number;
  search(query: string): Promise<RelateHit[]>;
  connections(path: string): { prop: string; path: string }[];
  similar(path: string, limit?: number): { path: string; score: number }[];
  meaningReady(): boolean;
}

const METHODS = ["search", "connections", "similar", "meaningReady"] as const;

/** The API when `value` is one Home Cards can use, else null. */
export function asRelateApi(value: unknown): RelateApi | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== RELATE_CONTRACT) return null;
  return METHODS.every((m) => typeof v[m] === "function") ? (value as RelateApi) : null;
}

/** How close in meaning, in words, from Relate's similarity score. */
export function closeness(score: number): string {
  if (score >= 0.75) return "Very close in meaning";
  if (score >= 0.6) return "Close in meaning";
  return "Related in meaning";
}

/**
 * What one compose sees of Relate: the API, guarded so a failure inside
 * Relate empties a section instead of breaking the page, plus searches
 * run before ranking, because ranking is synchronous and search is not.
 */
export interface RelateView {
  connections(path: string): { prop: string; path: string }[];
  similar(path: string, limit: number): { path: string; score: number }[];
  meaningReady(): boolean;
  /** Results of a search run before the compose; undefined when it was not run. */
  results(query: string): RelateHit[] | undefined;
}

export function relateView(api: RelateApi, searches: ReadonlyMap<string, RelateHit[]>): RelateView {
  const guard = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch (err) {
      console.error("Home Cards: Relate failed", err);
      return fallback;
    }
  };
  return {
    connections: (path) => guard(() => api.connections(path), []),
    similar: (path, limit) => guard(() => api.similar(path, limit), []),
    meaningReady: () => guard(() => api.meaningReady(), false),
    results: (query) => searches.get(query.trim()),
  };
}

/** How long a page waits for one Relate search before it shows the section empty. */
export const SEARCH_WAIT_MS = 2000;

export interface SearchOptions {
  /**
   * Results kept between composes, by query. The plugin empties it when
   * Relate reports a change or the vault's metadata settles, so a page
   * redrawn for any other reason does not search again.
   */
  cache?: Map<string, RelateHit[]>;
  waitMs?: number;
  /**
   * Resolves after `ms`. The plugin passes the window's timer, which
   * follows popout windows; without one, searches are awaited in full.
   */
  sleep?: (ms: number) => Promise<void>;
  /** Called when a search that missed the wait finishes, so the page can redraw with it. */
  onLate?: () => void;
}

/**
 * Run each distinct query once. A query that fails comes back empty; one
 * that takes longer than the wait comes back empty for now, and its
 * results go into the cache when they arrive.
 */
export async function runSearches(api: RelateApi, queries: readonly string[], opts: SearchOptions = {}): Promise<Map<string, RelateHit[]>> {
  const { cache, waitMs = SEARCH_WAIT_MS, onLate, sleep } = opts;
  const out = new Map<string, RelateHit[]>();
  const distinct = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  await Promise.all(
    distinct.map(async (q) => {
      const kept = cache?.get(q);
      if (kept) {
        out.set(q, kept);
        return;
      }
      let late = false;
      const search = api.search(q).then(
        (hits) => {
          const list = Array.isArray(hits) ? hits : [];
          cache?.set(q, list);
          if (late) onLate?.();
          return list;
        },
        (err: unknown) => {
          console.error("Home Cards: Relate search failed", err);
          return [] as RelateHit[];
        }
      );
      const hits = sleep ? await Promise.race([search, sleep(waitMs).then(() => null)]) : await search;
      if (hits === null) late = true;
      out.set(q, hits ?? []);
    })
  );
  return out;
}

/** A chain of links in words, from the result's side: "home: Minas Tirith → region: Gondor". */
export function chainText(steps: readonly RelateStep[]): string {
  return steps.map((s) => `${s.prop}: ${noteName(s.to)}`).join(" → ");
}

/**
 * Why a search result is on the card: its chain of links when it has one,
 * else Relate's reasons, leaving out a reason that only repeats the query.
 */
export function hitLead(hit: RelateHit, query: string): string | undefined {
  const chain = hit.paths.find((p) => p.length > 1);
  if (chain) return chainText(chain);
  // Reasons that only restate part of the query, such as "notes of Q3 Plan", say nothing new.
  const q = query.trim().toLowerCase();
  const reasons = hit.reasons.filter((r) => !q.includes(r.trim().toLowerCase()));
  return reasons.length ? reasons.join("; ") : undefined;
}
