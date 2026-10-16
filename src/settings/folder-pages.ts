/**
 * Folder pages: the path rules and section lookup behind a page that
 * shows one folder's notes.
 *
 * A folder with no entry in `settings.folderPages` still opens a page. It
 * shows the home page's sections, limited to the folder and everything
 * under it. An entry gives the folder sections of its own; those are
 * limited to the folder the same way. Nothing here touches the vault, so
 * the tests exercise it directly.
 */

import type { FolderPage, HomeCardsSettings, SectionConfig } from "./schema";
import { newSectionId } from "./schema";

/**
 * A vault folder path in one canonical form: forward slashes, no empty
 * segments, no leading or trailing slash. The vault root is "".
 */
export function normalizeFolderPath(raw: string): string {
  return raw
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

/** The folder's own name: the last segment of its path. */
export function folderName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Whether a vault path lies under `folder`. The root ("") holds every path. */
export function isInside(path: string, folder: string): boolean {
  return folder === "" || path.startsWith(`${folder}/`);
}

export function findFolderPage(
  pages: readonly FolderPage[],
  folder: string
): FolderPage | undefined {
  return pages.find((page) => page.path === folder);
}

/**
 * The sections a page shows: the folder's own when it has them, the home
 * page's otherwise. The home page itself (folder "") always uses its own.
 */
export function sectionsFor(
  settings: Pick<HomeCardsSettings, "sections" | "folderPages">,
  folder: string
): SectionConfig[] {
  if (!folder) return settings.sections;
  return findFolderPage(settings.folderPages, folder)?.sections ?? settings.sections;
}

/** Copies of `sections` with fresh ids, so a copy never shares identity with its source. */
export function cloneSections(sections: readonly SectionConfig[]): SectionConfig[] {
  return sections.map((section) => ({ ...section, id: newSectionId() }));
}

/**
 * Where `path` goes when the folder `from` is renamed or moved to `to`.
 * A path outside `from` is returned unchanged.
 */
export function reparent(path: string, from: string, to: string): string {
  if (path === from) return to;
  return path.startsWith(`${from}/`) ? to + path.slice(from.length) : path;
}

/**
 * Follow a folder rename: repoint every page at or under `from`. Mutates
 * `pages` and returns whether anything changed.
 */
export function renameFolderPages(pages: FolderPage[], from: string, to: string): boolean {
  let changed = false;
  for (const page of pages) {
    const next = reparent(page.path, from, to);
    if (next !== page.path) {
      page.path = next;
      changed = true;
    }
  }
  return changed;
}
