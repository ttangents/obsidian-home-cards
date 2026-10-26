/**
 * Vault-wide queries: the ones that walk every note's metadata or read a
 * file that is not a note. Each costs O(vault), so callers run them once
 * per compose rather than once per card.
 */

import type { App, CachedMetadata, TFile } from "obsidian";
import { mergeOpened } from "./open-history";
import type { ValueType } from "../settings/schema";
import { inferType, propertyValue } from "./conditions";
import { IMAGE_FILE, imageLinkFor } from "./images";
import type { ActivityFacts } from "./activity";
import type { ScopeTest } from "./scope";
import type { RelateView } from "./relate";

/** Which notes link to which: distinct links between notes, no self-links. */
export interface LinkGraph {
  out: ReadonlyMap<string, ReadonlySet<string>>;
  in: ReadonlyMap<string, ReadonlySet<string>>;
}

const NO_ACTIVITY: ActivityFacts = { events: () => [], visits: () => new Map() };

/**
 * One compose's view of the vault, shared by every section: the note
 * list is fetched once and the link totals are summed at most once, so
 * a page of seven sections costs one walk of the vault, not seven.
 * Discard it after the compose; it does not track later changes.
 */
export class VaultSnapshot {
  readonly files: readonly TFile[];
  private inbound: ReadonlyMap<string, number> | null = null;
  private graph: LinkGraph | null = null;

  constructor(
    readonly app: App,
    /** The moment of the compose; date-based rankings measure from it. */
    readonly now: Date = new Date(),
    /** The plugin's own open history, newest first (see open-history.ts). */
    private readonly history: readonly string[] = [],
    /** The page's scope: the snapshot holds only the notes it admits. */
    scope: ScopeTest | null = null,
    /** Opens and visits Home Cards observed (see activity.ts). */
    readonly activity: ActivityFacts = NO_ACTIVITY,
    /** Relate, when it is installed and running; see relate.ts. */
    readonly relate: RelateView | null = null
  ) {
    this.files = notesIn(app, scope);
  }

  /**
   * The note-to-note link graph, from the metadata cache's resolved links,
   * built once per compose on first use. Links to attachments are left out.
   */
  links(): LinkGraph {
    if (this.graph) return this.graph;
    const out = new Map<string, Set<string>>();
    const inn = new Map<string, Set<string>>();
    const add = (map: Map<string, Set<string>>, key: string, value: string) => {
      const set = map.get(key);
      if (set) set.add(value);
      else map.set(key, new Set([value]));
    };
    for (const [source, targets] of Object.entries(this.app.metadataCache.resolvedLinks ?? {})) {
      for (const target of Object.keys(targets ?? {})) {
        if (target === source || !target.endsWith(".md")) continue;
        add(out, source, target);
        add(inn, target, source);
      }
    }
    return (this.graph = { out, in: inn });
  }

  /** The note at `path`, inside the page's scope or not; null when there is none. */
  fileAt(path: string): TFile | null {
    return this.app.vault.getFileByPath(path);
  }

  /** Distinct notes linked to or from `path`. */
  degree(path: string): number {
    const { out, in: inn } = this.links();
    const o = out.get(path);
    const i = inn.get(path);
    if (!o) return i?.size ?? 0;
    if (!i) return o.size;
    let n = o.size;
    for (const p of i) if (!o.has(p)) n++;
    return n;
  }

  /** Paths of recently opened files, newest first. */
  openedPaths(): string[] {
    return mergeOpened(this.app.workspace.getLastOpenFiles(), this.history);
  }

  cacheOf(file: TFile): CachedMetadata | null {
    return this.app.metadataCache.getFileCache(file);
  }

  /**
   * The resource URL of a note's card image, resolved as Obsidian resolves
   * a link written in that note; null when the link leads to no image.
   */
  imageUrl(file: TFile, cache: CachedMetadata | null, properties: string): string | null {
    const link = imageLinkFor(cache, properties);
    if (!link) return null;
    const dest = this.app.metadataCache.getFirstLinkpathDest(link, file.path);
    return dest && IMAGE_FILE.test(dest.path) ? this.app.vault.getResourcePath(dest) : null;
  }

  /** Inbound link totals per path; computed on first use. */
  inboundCounts(): ReadonlyMap<string, number> {
    return (this.inbound ??= inboundCounts(this.app));
  }
}

/**
 * The notes a page is about: every note the scope admits, or all of them
 * when the page has none. Link totals elsewhere stay vault-wide.
 */
export function notesIn(app: App, scope: ScopeTest | null): TFile[] {
  const all = app.vault.getMarkdownFiles();
  if (!scope) return all;
  return all.filter((file) => scope(file, app.metadataCache.getFileCache(file)));
}

/**
 * The path for a new note in `folder` ("" for the vault root): "Untitled",
 * then "Untitled 1", "Untitled 2" and so on, as Obsidian names them.
 */
export function untitledPath(folder: string, exists: (path: string) => boolean): string {
  const prefix = folder ? `${folder}/` : "";
  for (let n = 0; ; n++) {
    const path = `${prefix}Untitled${n ? ` ${n}` : ""}.md`;
    if (!exists(path)) return path;
  }
}

/**
 * Every frontmatter key in the vault with the type its values read as,
 * sorted by key, for the section editor. One walk of the metadata cache;
 * up to a few hundred values per key decide its type.
 */
export function discoverPropertyTypes(app: App): Map<string, ValueType> {
  const samples = new Map<string, unknown[]>();
  for (const file of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) continue;
    for (const [k, v] of Object.entries(fm)) {
      if (k === "position") continue;
      const list = samples.get(k) ?? [];
      if (list.length < 300) list.push(v);
      samples.set(k, list);
    }
  }
  const keys = [...samples.keys()].sort((a, b) => a.localeCompare(b));
  return new Map(keys.map((k) => [k, inferType(samples.get(k) ?? [])]));
}

/**
 * The values the vault uses for one property, the most common first, for
 * a value picker. Lists contribute each member; at most `limit` values.
 */
export function discoverValues(app: App, key: string, limit = 200): string[] {
  const counts = new Map<string, number>();
  for (const file of app.vault.getMarkdownFiles()) {
    const raw = propertyValue(app.metadataCache.getFileCache(file), key);
    for (const v of Array.isArray(raw) ? raw : [raw]) {
      if (typeof v !== "string" && typeof v !== "number") continue;
      const text = String(v).trim();
      if (text) counts.set(text, (counts.get(text) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([v]) => v);
}

/**
 * Inbound link totals per note path, summed from the resolved-links
 * table. One pass over the link graph; no file reads. Notes nobody links
 * to are absent, and callers read absence as zero.
 */
export function inboundCounts(app: App): Map<string, number> {
  const totals = new Map<string, number>();
  const table = app.metadataCache.resolvedLinks ?? {};
  for (const targets of Object.values(table)) {
    for (const [target, n] of Object.entries(targets ?? {})) {
      totals.set(target, (totals.get(target) ?? 0) + n);
    }
  }
  return totals;
}
