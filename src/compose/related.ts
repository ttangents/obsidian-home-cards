/**
 * Related to recent work: notes connected to what the reader opened in
 * the latest work session, scored from the link graph and tags, and from
 * Relate when it is installed. Every card says which connection put it there.
 *
 * For each recent note (a seed), a candidate earns:
 *
 * - 3 for a direct link, either way;
 * - 1 for each neighbour the two share (a note both link to or are linked
 *   from), up to 3, passing over neighbours with more than 50 links, whose
 *   links say little about any one note;
 * - 0.5 for each tag the two share, up to 2 tags.
 *
 * With Relate installed, a candidate also earns 3.5 for a relationship
 * with a seed, named from the seed's side ("Q3 Plan's notes"), and twice
 * its closeness in meaning to a seed when search by meaning is on.
 *
 * A candidate needs a score of at least 1, so one shared tag alone is not
 * a relation. The seeds themselves are left out; they belong in Continue
 * working.
 *
 * Pure: reads only the vault snapshot it is given.
 */

import type { TFile } from "obsidian";
import type { Ranked } from "./rank";
import { tagsOf } from "./scope";
import { sessionsFrom } from "./sessions";
import type { VaultSnapshot } from "./vault";
import { noteName } from "../settings/folders";

/** Recent notes the scores start from. */
export const SEED_COUNT = 5;
/** Neighbours with more links than this are passed over. */
export const BUSY_NEIGHBOUR = 50;
const MIN_SCORE = 1;
/** A relationship recorded through Relate outweighs the plain link beneath it, so it names the card. */
const RELATIONSHIP = 3.5;
/** Notes close in meaning to each seed that Relate is asked for. */
const SIMILAR_PER_SEED = 10;

interface Score {
  total: number;
  /** The single strongest reason, and what it is worth. */
  reason: string;
  weight: number;
}


/** The latest session's notes, or the open history when there is no session yet. */
export function recentSeeds(vault: VaultSnapshot): string[] {
  const [latest] = sessionsFrom(vault.activity.events());
  const paths = latest ? latest.notes.map((n) => n.path) : vault.openedPaths();
  return paths.slice(0, SEED_COUNT);
}

export function relatedToRecent(vault: VaultSnapshot, pool: readonly TFile[]): Ranked[] {
  const seeds = recentSeeds(vault);
  if (!seeds.length) return [];
  const seedSet = new Set(seeds);
  const byPath = new Map(pool.map((f) => [f.path, f]));
  const { out, in: inn } = vault.links();
  const neighbours = (p: string) => new Set([...(out.get(p) ?? []), ...(inn.get(p) ?? [])]);
  const scores = new Map<string, Score>();
  const add = (path: string, weight: number, reason: string) => {
    if (seedSet.has(path) || !byPath.has(path) || weight <= 0) return;
    const s = scores.get(path);
    if (!s) scores.set(path, { total: weight, reason, weight });
    else {
      s.total += weight;
      if (weight > s.weight) {
        s.weight = weight;
        s.reason = reason;
      }
    }
  };

  for (const seed of seeds) {
    const name = noteName(seed);
    for (const target of out.get(seed) ?? []) add(target, 3, `Linked from ${name}`);
    for (const source of inn.get(seed) ?? []) add(source, 3, `Links to ${name}`);

    const shared = new Map<string, number>();
    for (const middle of neighbours(seed)) {
      if (vault.degree(middle) > BUSY_NEIGHBOUR) continue;
      for (const other of neighbours(middle)) {
        if (other !== seed) shared.set(other, (shared.get(other) ?? 0) + 1);
      }
    }
    for (const [path, n] of shared) {
      add(path, Math.min(n, 3), `${n} shared ${n === 1 ? "link" : "links"} with ${name}`);
    }

    // With Relate: a named relationship says more than a bare link, and
    // closeness in meaning finds notes that no link joins.
    if (vault.relate) {
      for (const conn of vault.relate.connections(seed)) add(conn.path, RELATIONSHIP, `${name}'s ${conn.prop}`);
      if (vault.relate.meaningReady()) {
        for (const hit of vault.relate.similar(seed, SIMILAR_PER_SEED)) add(hit.path, 2 * hit.score, `Close in meaning to ${name}`);
      }
    }

    const seedFile = vault.fileAt(seed);
    const seedTags = new Set(tagsOf(seedFile ? vault.cacheOf(seedFile) : null).map((t) => t.toLowerCase()));
    if (!seedTags.size) continue;
    for (const file of pool) {
      if (file.path === seed) continue;
      const common = [...new Set(tagsOf(vault.cacheOf(file)).map((t) => t.toLowerCase()))].filter((t) => seedTags.has(t));
      if (common.length) add(file.path, 0.5 * Math.min(common.length, 2), `Shares #${common[0]} with ${name}`);
    }
  }

  return [...scores]
    .filter(([, s]) => s.total >= MIN_SCORE)
    .sort((a, b) => b[1].total - a[1].total || (byPath.get(b[0])?.stat.mtime ?? 0) - (byPath.get(a[0])?.stat.mtime ?? 0))
    .flatMap(([path, s]) => {
      const file = byPath.get(path);
      return file ? [{ file, lead: s.reason }] : [];
    });
}
