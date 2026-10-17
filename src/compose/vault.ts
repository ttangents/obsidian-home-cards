/**
 * Vault-wide queries: the ones that walk every note's metadata or read a
 * file that is not a note. Each costs O(vault), so callers run them once
 * per compose rather than once per card.
 */

import type { App, CachedMetadata, TFile } from "obsidian";
import { mergeOpened } from "./open-history";
import type { ScopeTest } from "./scope";

/**
 * One compose's view of the vault, shared by every section: the note
 * list is fetched once and the link totals are summed at most once, so
 * a page of seven sections costs one walk of the vault, not seven.
 * Discard it after the compose; it does not track later changes.
 */
export class VaultSnapshot {
  readonly files: readonly TFile[];
  private inbound: ReadonlyMap<string, number> | null = null;

  constructor(
    readonly app: App,
    /** The moment of the compose; date-based rankings measure from it. */
    readonly now: Date = new Date(),
    /** The plugin's own open history, newest first (see open-history.ts). */
    private readonly history: readonly string[] = [],
    /** The page's scope: the snapshot holds only the notes it admits. */
    scope: ScopeTest | null = null
  ) {
    this.files = notesIn(app, scope);
  }

  /** Paths of recently opened files, newest first. */
  openedPaths(): string[] {
    return mergeOpened(this.app.workspace.getLastOpenFiles(), this.history);
  }

  cacheOf(file: TFile): CachedMetadata | null {
    return this.app.metadataCache.getFileCache(file);
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

/** Every frontmatter key in the vault, sorted, for the settings pickers. */
export function discoverProperties(app: App): string[] {
  const keys = new Set<string>();
  for (const file of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) continue;
    for (const k of Object.keys(fm)) if (k !== "position") keys.add(k);
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
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

interface TypifyStyle {
  name?: string;
  icon?: string;
  appliesTo?: string[];
}

/**
 * Typify's icon per type value, keyed lowercase, for styles that apply
 * to `typeKey`. An optional integration with another plugin's data
 * file, read only when the user picks "Typify icon": absent, malformed or
 * reshaped data yields an empty map, and cards fall back to their
 * initial letter.
 */
export async function loadTypifyIcons(app: App, typeKey: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const path = `${app.vault.configDir}/plugins/typify/data.json`;
  try {
    if (!(await app.vault.adapter.exists(path))) return out;
    const parsed = JSON.parse(await app.vault.adapter.read(path)) as {
      statusStyles?: TypifyStyle[];
    };
    for (const style of parsed.statusStyles ?? []) {
      const name = (style.name ?? "").trim();
      const icon = (style.icon ?? "").trim();
      if (!name || !icon) continue;
      if (!(style.appliesTo ?? ["type"]).includes(typeKey)) continue;
      out.set(name.toLowerCase(), icon);
    }
  } catch {
    return new Map();
  }
  return out;
}
