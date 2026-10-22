/**
 * Vault folder paths: one canonical form, containment, renames. Nothing
 * here touches the vault, so the tests exercise it directly.
 */

import type { SectionConfig } from "./schema";
import { copySection, newSectionId } from "./schema";

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

/** A note's name from its path: "Projects/Q3 Plan.md" is "Q3 Plan". */
export function noteName(path: string): string {
  return folderName(path).replace(/\.md$/, "");
}

/** Whether a vault path lies under `folder`. The root ("") holds every path. */
export function isInside(path: string, folder: string): boolean {
  return folder === "" || path.startsWith(`${folder}/`);
}

/**
 * Where `path` goes when the folder `from` is renamed or moved to `to`.
 * A path outside `from` is returned unchanged.
 */
export function reparent(path: string, from: string, to: string): string {
  if (path === from) return to;
  return path.startsWith(`${from}/`) ? to + path.slice(from.length) : path;
}

/** Copies of `sections` with fresh ids, so a copy never shares identity with its source. */
export function cloneSections(sections: readonly SectionConfig[]): SectionConfig[] {
  return sections.map((section) => copySection(section, newSectionId()));
}
