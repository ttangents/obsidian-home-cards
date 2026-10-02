/**
 * A longer memory of opened notes than Obsidian's own.
 *
 * Obsidian remembers the last ten files opened (`getLastOpenFiles`). A
 * "Recently opened" section may ask for more cards than that, and "See
 * more" needs more again, so the plugin keeps its own list of note paths,
 * newest first, in Obsidian's local storage: per device, like Obsidian's
 * list, and outside the synced settings.
 *
 * Pure apart from the injected store, so the tests drive it directly.
 */

import type { App } from "obsidian";

export type LocalStore = Pick<App, "loadLocalStorage" | "saveLocalStorage">;

const STORE_KEY = "home-cards-opened";

/** Paths kept. Enough for a section of 24 cards and three pages more. */
export const HISTORY_LIMIT = 100;

export class OpenHistory {
  /** Newest first. Loaded on first use, so startup does no storage read. */
  private paths: string[] | null = null;

  constructor(private readonly store: LocalStore) {}

  /** Opened note paths, newest first. */
  list(): readonly string[] {
    return this.load();
  }

  /** Move `path` to the front. */
  record(path: string): void {
    const paths = this.load();
    if (paths[0] === path) return;
    const at = paths.indexOf(path);
    if (at >= 0) paths.splice(at, 1);
    paths.unshift(path);
    paths.length = Math.min(paths.length, HISTORY_LIMIT);
    this.save();
  }

  /** Follow a rename, so a moved note keeps its place. */
  rename(oldPath: string, newPath: string): void {
    const paths = this.load();
    const at = paths.indexOf(oldPath);
    if (at < 0) return;
    paths[at] = newPath;
    // A rename onto a path already listed leaves one entry, the newer.
    const dupe = paths.indexOf(newPath, at + 1);
    if (dupe >= 0) paths.splice(dupe, 1);
    this.save();
  }

  private load(): string[] {
    if (this.paths) return this.paths;
    let stored: unknown = null;
    try {
      stored = this.store.loadLocalStorage(STORE_KEY);
    } catch (err) {
      console.error("Home Cards: could not read the open history", err);
    }
    this.paths = Array.isArray(stored)
      ? stored.filter((p): p is string => typeof p === "string").slice(0, HISTORY_LIMIT)
      : [];
    return this.paths;
  }

  private save(): void {
    try {
      this.store.saveLocalStorage(STORE_KEY, this.paths);
    } catch (err) {
      console.error("Home Cards: could not save the open history", err);
    }
  }
}

/**
 * Obsidian's list first, as the authority on the most recent opens
 * (it also covers opens from before the plugin was installed), then the
 * plugin's longer tail, each path once.
 */
export function mergeOpened(recent: readonly string[], history: readonly string[]): string[] {
  return [...new Set([...recent, ...history])];
}
