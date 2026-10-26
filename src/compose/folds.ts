/**
 * Folded sections, kept per device in Obsidian's local storage: the key a
 * section's folded state is stored under, and the pruning that keeps the
 * list from growing with every note page ever folded.
 *
 * Pure: the caller says which pages still exist.
 */

/** Folded sections kept at most; the oldest go first. */
export const FOLDS_MAX = 500;

/**
 * The key a section's folded state is stored under. Every other page
 * keys on its own identity as well, so folding "Recently modified" on
 * one page does not fold it on the rest; the home page keeps its
 * original keys, the plain section ids.
 */
export function foldKey(sectionId: string, page: { isHome: boolean; key: string }): string {
  return page.isHome ? sectionId : `${sectionId}@${page.key}`;
}

/** The page a fold key belongs to: its page key, or "home" for a plain section id. */
export function foldPage(key: string): string {
  const at = key.search(/@(?:page|folder|note):/);
  return at < 0 ? "home" : key.slice(at + 1);
}

/**
 * The fold keys worth keeping: those whose page still exists, the newest
 * `max` of them. Keys are listed oldest first.
 */
export function pruneFolds(keys: readonly string[], pageExists: (pageKey: string) => boolean, max = FOLDS_MAX): string[] {
  const live = keys.filter((key) => {
    const page = foldPage(key);
    return page === "home" || pageExists(page);
  });
  return live.slice(Math.max(0, live.length - max));
}
