/**
 * Ranking: which notes a section wants, best first, decided from the
 * metadata cache alone. No file is read here; only the notes that win a
 * slot are read later, and only for their opening sentence.
 */

import type { App, TFile } from "obsidian";
import type { HomeCardsSettings, SectionConfig } from "../settings/schema";
import { compileScope, tagsOf } from "./scope";
import { cleanTitle } from "./text";
import { firstValue, frontmatterValue, asStringList } from "./values";
import { inboundCounts } from "./vault";

/** A ranked note, with the figure it ranked on when that is worth showing. */
export interface Ranked {
  file: TFile;
  /** Leads the card footer, e.g. "7 links". */
  lead?: string;
}

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
  app: App,
  files: TFile[],
  key: string,
  dir: SectionConfig["sortDir"],
  settings: HomeCardsSettings
): TFile[] {
  const title = byTitle(settings);
  const sign = dir === "desc" ? -1 : 1;
  return files
    .map((file) => {
      const value = key ? firstValue(frontmatterValue(app.metadataCache.getFileCache(file), key)) : "";
      return {
        file,
        has: value !== "",
        key: value || String(file.stat.mtime).padStart(16, "0"),
        title: title(file),
      };
    })
    .sort((a, b) => {
      if (a.has !== b.has) return a.has ? -1 : 1;
      // localeCompare, not < >, or text values sort in ASCII order.
      const primary = sign * a.key.localeCompare(b.key, undefined, { numeric: true });
      return primary || a.title.localeCompare(b.title);
    })
    .map((d) => d.file);
}

function byPopularity(
  app: App,
  files: TFile[],
  most: boolean,
  settings: HomeCardsSettings
): Ranked[] {
  const counts = inboundCounts(app);
  const title = byTitle(settings);
  const sign = most ? -1 : 1;
  return files
    .map((file) => ({ file, n: counts.get(file.path) ?? 0, title: title(file) }))
    // Least-linked lists orphans, which all tie at zero; the title
    // tie-break is what makes that list readable.
    .sort((a, b) => sign * (a.n - b.n) || a.title.localeCompare(b.title))
    .map(({ file, n }) => ({ file, lead: `${n} ${n === 1 ? "link" : "links"}` }));
}

const plain = (files: TFile[]): Ranked[] => files.map((file) => ({ file }));

/** Every note the section admits, best first. */
export function rankSection(
  app: App,
  cfg: SectionConfig,
  settings: HomeCardsSettings
): Ranked[] {
  const scope = compileScope(cfg);
  const cacheOf = (f: TFile) => app.metadataCache.getFileCache(f);
  const pool = app.vault
    .getMarkdownFiles()
    .filter((f) => !scope || scope(f, cacheOf(f)));

  switch (cfg.kind) {
    case "recent-opened": {
      const byPath = new Map(pool.map((f) => [f.path, f]));
      return plain(
        app.workspace
          .getLastOpenFiles()
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
      return byPopularity(app, pool, cfg.kind === "most-linked", settings);
    case "tag": {
      const want = cfg.tag.replace(/^#/, "").toLowerCase();
      if (!want) return [];
      const hits = pool.filter((f) =>
        tagsOf(cacheOf(f)).some((t) => {
          const tag = t.toLowerCase();
          return tag === want || tag.startsWith(`${want}/`);
        })
      );
      return plain(sortByKey(app, hits, cfg.sortKey, cfg.sortDir, settings));
    }
    case "property": {
      if (!cfg.propertyKey) return [];
      const want = cfg.propertyValue.trim().toLowerCase();
      const hits = pool.filter((f) => {
        const raw = frontmatterValue(cacheOf(f), cfg.propertyKey);
        if (raw == null || raw === "") return false;
        return !want || asStringList(raw).some((v) => v.toLowerCase() === want);
      });
      return plain(sortByKey(app, hits, cfg.sortKey || cfg.propertyKey, cfg.sortDir, settings));
    }
  }
}
