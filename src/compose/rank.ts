/**
 * Ranking: which notes a section wants, best first, decided from the
 * metadata cache alone. No file is read here; only the notes that win a
 * slot are read later, and only for their opening sentence.
 */

import type { TFile } from "obsidian";
import { emptyMarks, type HomeCardsSettings, type NoteMarks, type SectionConfig } from "../settings/schema";
import { compileConditions } from "./conditions";
import { continueWorking } from "./continue";
import { rediscover } from "./rediscover";
import { relatedToRecent } from "./related";
import { isSnoozed } from "./marks";
import { compileScope, tagsOf } from "./scope";
import { cleanTitle } from "./text";
import { firstValue, frontmatterValue, asStringList } from "./values";
import type { VaultSnapshot } from "./vault";

/** A ranked note, with the figure it ranked on when that is worth showing. */
export interface Ranked {
  file: TFile;
  /** Leads the card footer, e.g. "7 links". */
  lead?: string;
}

/**
 * One collator for every comparison. `localeCompare` with options builds
 * a collator per call, which dominates the sort on a large vault.
 * `numeric` orders "Item 9" before "Item 10" and ISO dates correctly.
 */
const collator = new Intl.Collator(undefined, { numeric: true });

const byTitle = (settings: HomeCardsSettings) => (file: TFile) =>
  cleanTitle(file.basename, settings);

/**
 * Sort on a frontmatter key, decorating each file once rather than
 * reading the cache inside the comparator (O(n) lookups, not O(n log n)).
 *
 * A note whose key is absent or blank falls back to its mtime and always
 * sorts after every note that has a value, whichever direction applies.
 * Ties break on the displayed title, so "(Report) Treat…" files under T.
 */
function sortByKey(
  vault: VaultSnapshot,
  files: readonly TFile[],
  key: string,
  dir: SectionConfig["sortDir"],
  settings: HomeCardsSettings
): TFile[] {
  const title = byTitle(settings);
  const sign = dir === "desc" ? -1 : 1;
  return files
    .map((file) => {
      const value = key ? firstValue(frontmatterValue(vault.cacheOf(file), key)) : "";
      return {
        file,
        has: value !== "",
        key: value || String(file.stat.mtime).padStart(16, "0"),
        title: title(file),
      };
    })
    .sort((a, b) => {
      if (a.has !== b.has) return a.has ? -1 : 1;
      // A collator, not < >, or text values sort in ASCII order.
      const primary = sign * collator.compare(a.key, b.key);
      return primary || collator.compare(a.title, b.title);
    })
    .map((d) => d.file);
}

function byPopularity(
  vault: VaultSnapshot,
  files: readonly TFile[],
  most: boolean,
  settings: HomeCardsSettings
): Ranked[] {
  const counts = vault.inboundCounts();
  const title = byTitle(settings);
  const sign = most ? -1 : 1;
  return files
    .map((file) => ({ file, n: counts.get(file.path) ?? 0, title: title(file) }))
    // Least-linked lists orphans, which all tie at zero; the title
    // tie-break is what makes that list readable.
    .sort((a, b) => sign * (a.n - b.n) || collator.compare(a.title, b.title))
    .map(({ file, n }) => ({ file, lead: `${n} ${n === 1 ? "link" : "links"}` }));
}

const plain = (files: readonly TFile[]): Ranked[] => files.map((file) => ({ file }));

/**
 * The notes a section admits before ranking: its include-filters and its
 * conditions, over the page's notes. A note must pass both.
 */
export function sectionPool(vault: VaultSnapshot, cfg: SectionConfig, marks: NoteMarks = emptyMarks()): readonly TFile[] {
  const scope = compileScope(cfg);
  const conditions = compileConditions(cfg.conditions, vault.now);
  // Snoozed notes sit out every section but Pinned; quiet ones, Rediscover.
  const snoozed = cfg.kind !== "pinned" && Object.keys(marks.snoozed).length > 0;
  const quiet = cfg.kind === "rediscover" && marks.quiet.length > 0 ? new Set(marks.quiet) : null;
  if (!scope && !conditions && !snoozed && !quiet) return vault.files;
  return vault.files.filter((f) => {
    if (snoozed && isSnoozed(marks, f.path, vault.now)) return false;
    if (quiet?.has(f.path)) return false;
    const cache = vault.cacheOf(f);
    return (!scope || scope(f, cache)) && (!conditions || conditions(f, cache));
  });
}

/** Every note the section admits, best first. */
export function rankSection(
  vault: VaultSnapshot,
  cfg: SectionConfig,
  settings: HomeCardsSettings
): Ranked[] {
  const cacheOf = (f: TFile) => vault.cacheOf(f);
  const pool = sectionPool(vault, cfg, settings.marks);

  switch (cfg.kind) {
    case "pinned": {
      const byPath = new Map(pool.map((f) => [f.path, f]));
      return plain(settings.marks.pinned.map((p) => byPath.get(p)).filter((f): f is TFile => f !== undefined));
    }
    case "recent-opened": {
      const byPath = new Map(pool.map((f) => [f.path, f]));
      return plain(
        vault
          .openedPaths()
          .map((p) => byPath.get(p))
          .filter((f): f is TFile => f !== undefined)
      );
    }
    case "recent-created":
      return plain([...pool].sort((a, b) => b.stat.ctime - a.stat.ctime));
    case "recent-modified":
      return plain([...pool].sort((a, b) => b.stat.mtime - a.stat.mtime));
    case "most-linked":
    case "least-linked":
      return byPopularity(vault, pool, cfg.kind === "most-linked", settings);
    case "rediscover":
      return rediscover(vault, pool, cfg, settings);
    case "continue":
      return continueWorking(vault, pool);
    case "related":
      return relatedToRecent(vault, pool);
    case "tag": {
      const want = cfg.tag.replace(/^#/, "").toLowerCase();
      if (!want) return [];
      const hits = pool.filter((f) =>
        tagsOf(cacheOf(f)).some((t) => {
          const tag = t.toLowerCase();
          return tag === want || tag.startsWith(`${want}/`);
        })
      );
      return plain(sortByKey(vault, hits, cfg.sortKey, cfg.sortDir, settings));
    }
    case "property": {
      if (!cfg.propertyKey) return [];
      const want = cfg.propertyValue.trim().toLowerCase();
      const hits = pool.filter((f) => {
        const raw = frontmatterValue(cacheOf(f), cfg.propertyKey);
        if (raw == null || raw === "") return false;
        return !want || asStringList(raw).some((v) => v.toLowerCase() === want);
      });
      return plain(sortByKey(vault, hits, cfg.sortKey || cfg.propertyKey, cfg.sortDir, settings));
    }
  }
}
