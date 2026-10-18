/**
 * Named pages: which page a view shows, how a stored reference resolves
 * to a page, and the rules for page names, folder renames and new notes.
 *
 * Three kinds of page share one view. The home page has no reference. A
 * named page is a record in `settings.pages`, referenced by its id. A
 * folder page is referenced by its folder; the folder may have a record
 * (a named page with a folder scope) or not, and the reference resolves
 * to the record when there is one, so that every route to the same page
 * lands on the same tab.
 *
 * Nothing here touches the vault, so the tests exercise it directly.
 */

import { folderName, normalizeFolderPath, reparent } from "./folders";
import {
  blankScope,
  LIMITS,
  type HomeCardsSettings,
  type NamedPage,
  type PageScope,
  type SectionConfig,
} from "./schema";
import { PAGE_SCOPES } from "./schema";

/** The page a view shows, as the view saves it in the workspace layout. */
export interface PageRef {
  /** A named page's id. */
  page?: string;
  /** A folder's path: its named page if it has one, else a plain folder page. */
  folder?: string;
}

export interface ResolvedPage {
  /** Identity of the page: equal keys are the same tab and the same folded sections. */
  key: string;
  isHome: boolean;
  /** The saved record; null for the home page and for a folder without one. */
  record: NamedPage | null;
  title: string;
  scope: PageScope;
  /** The sections to compose: the page's own or the home page's. */
  sections: SectionConfig[];
  icon: string;
}

// --------------------------------------------------------------- references

/** Read a saved view state. Anything unrecognizable is the home page. */
export function refFromState(state: unknown): PageRef {
  const raw = (state ?? {}) as { page?: unknown; folder?: unknown };
  if (typeof raw.page === "string" && raw.page) return { page: raw.page };
  if (typeof raw.folder === "string") {
    const folder = normalizeFolderPath(raw.folder);
    if (folder) return { folder };
  }
  return {};
}

export function stateFromRef(ref: PageRef): Record<string, string> {
  if (ref.page) return { page: ref.page };
  if (ref.folder) return { folder: ref.folder };
  return {};
}

export function sameRef(a: PageRef, b: PageRef): boolean {
  return (a.page ?? "") === (b.page ?? "") && (a.folder ?? "") === (b.folder ?? "");
}

// ------------------------------------------------------------------ lookup

export function findPage(pages: readonly NamedPage[], id: string): NamedPage | undefined {
  return pages.find((page) => page.id === id);
}

/** The named page whose scope is exactly this folder. */
export function findFolderPage(pages: readonly NamedPage[], folder: string): NamedPage | undefined {
  return pages.find((page) => page.scope.kind === "folder" && page.scope.folder === folder);
}

/**
 * The page an `obsidian://` link or a typed name means: an id, else a
 * name, compared without regard to case.
 */
export function findPageByName(pages: readonly NamedPage[], text: string): NamedPage | undefined {
  const wanted = text.trim().toLowerCase();
  if (!wanted) return undefined;
  return pages.find((p) => p.id === text.trim()) ?? pages.find((p) => p.name.toLowerCase() === wanted);
}

export function scopeIcon(scope: PageScope): string {
  return PAGE_SCOPES.find((s) => s.id === scope.kind)?.icon ?? "layout-grid";
}

function fromRecord(settings: Pick<HomeCardsSettings, "sections">, page: NamedPage): ResolvedPage {
  return {
    key: `page:${page.id}`,
    isHome: false,
    record: page,
    title: page.name,
    scope: page.scope,
    sections: page.sections ?? settings.sections,
    icon: scopeIcon(page.scope),
  };
}

/**
 * Resolve a reference against the settings. Null means a named page that
 * no longer exists; the view then says so, and the tab stays until the
 * user closes it.
 */
export function resolvePage(
  settings: Pick<HomeCardsSettings, "sections" | "pages">,
  ref: PageRef
): ResolvedPage | null {
  if (ref.page) {
    const page = findPage(settings.pages, ref.page);
    return page ? fromRecord(settings, page) : null;
  }
  if (ref.folder) {
    const page = findFolderPage(settings.pages, ref.folder);
    if (page) return fromRecord(settings, page);
    const scope: PageScope = { ...blankScope(), kind: "folder", folder: ref.folder };
    return {
      key: `folder:${ref.folder}`,
      isHome: false,
      record: null,
      title: folderName(ref.folder),
      scope,
      sections: settings.sections,
      icon: scopeIcon(scope),
    };
  }
  return {
    key: "home",
    isHome: true,
    record: null,
    title: "Home",
    scope: blankScope(),
    sections: settings.sections,
    icon: scopeIcon(blankScope()),
  };
}

// ------------------------------------------------------------------- scopes

/** Whether the scope names what it needs to. A blank one admits every note. */
export function isScopeBlank(scope: PageScope): boolean {
  switch (scope.kind) {
    case "folder":
      return !scope.folder;
    case "tag":
      return !scope.tag.trim();
    case "property":
      return !scope.propertyKey.trim();
    default:
      return true;
  }
}

/** The scope in a few words, for lists and datelines. */
export function scopeSummary(scope: PageScope): string {
  if (isScopeBlank(scope)) return scope.kind === "all" ? "Whole vault" : `${labelOfKind(scope)}: not set`;
  switch (scope.kind) {
    case "folder":
      return `Folder: ${scope.folder}`;
    case "tag":
      return `Tag: #${scope.tag.replace(/^#/, "")}`;
    default:
      return scope.propertyValue
        ? `Property: ${scope.propertyKey} = ${scope.propertyValue}`
        : `Property: ${scope.propertyKey}`;
  }
}

function labelOfKind(scope: PageScope): string {
  return PAGE_SCOPES.find((s) => s.id === scope.kind)?.label ?? scope.kind;
}

/** A name for a page that has none: its folder, tag or property. */
export function suggestPageName(scope: PageScope): string {
  if (isScopeBlank(scope)) return "Page";
  switch (scope.kind) {
    case "folder":
      return folderName(scope.folder);
    case "tag":
      return `#${scope.tag.replace(/^#/, "")}`;
    default:
      return scope.propertyValue ? `${scope.propertyKey}: ${scope.propertyValue}` : scope.propertyKey;
  }
}

// -------------------------------------------------------------------- names

/**
 * A name no other page has, compared without regard to case: the wanted
 * name, trimmed and cut to length, with " 2", " 3" and so on added until
 * it is free. `exceptId` is the page being renamed, which may keep its own.
 */
export function uniquePageName(pages: readonly NamedPage[], wanted: string, exceptId = ""): string {
  const base = wanted.trim().slice(0, LIMITS.pageName.max).trim() || "Page";
  const taken = new Set(pages.filter((p) => p.id !== exceptId).map((p) => p.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const name = base.slice(0, LIMITS.pageName.max - suffix.length).trim() + suffix;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

/**
 * A stable id for a page migrated from a folder entry: the same folder
 * always yields the same id, so tabs saved before the migration was
 * written back to data.json still find their page.
 */
export function legacyFolderPageId(folder: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < folder.length; i++) {
    hash ^= folder.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `page-f${hash.toString(36)}`;
}

// ------------------------------------------------------------------ renames

/**
 * Follow a folder rename: repoint every folder-scoped page at or under
 * `from`. Mutates `pages` and returns whether anything changed.
 */
export function renamePageFolders(pages: NamedPage[], from: string, to: string): boolean {
  let changed = false;
  for (const page of pages) {
    if (page.scope.kind !== "folder") continue;
    const next = reparent(page.scope.folder, from, to);
    if (next !== page.scope.folder) {
      page.scope.folder = next;
      changed = true;
    }
  }
  return changed;
}
