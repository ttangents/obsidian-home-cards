/**
 * The right sidebar on Home Cards' pages.
 *
 * Obsidian's right sidebar shows the last note the reader opened: its
 * properties, backlinks, outline and the panels other plugins add. On the
 * home page, a named page or a folder page, that note is not on screen, so
 * the sidebar would describe the wrong page. Home Cards closes the sidebar
 * when one of those pages comes to the front, and opens it again when the
 * reader returns to a note, but only if Home Cards was the one that closed
 * it. A note's own page keeps the sidebar, since it shows that note.
 */

/** What came to the front. */
export interface SidebarFocus {
  /** A Home Cards page that is not a single note's page. */
  listingPage: boolean;
  /** A panel in either sidebar, which leaves the sidebar as it is. */
  inSidebar: boolean;
}

export type SidebarStep = "close" | "reopen" | "none";

/**
 * The step to take when a tab comes to the front, and whether Home Cards
 * has the sidebar closed afterwards.
 */
export function sidebarStep(
  closedByHome: boolean,
  focus: SidebarFocus,
  collapsed: boolean
): { step: SidebarStep; closedByHome: boolean } {
  if (focus.inSidebar) return { step: "none", closedByHome };
  if (focus.listingPage) {
    return collapsed ? { step: "none", closedByHome } : { step: "close", closedByHome: true };
  }
  return { step: closedByHome && collapsed ? "reopen" : "none", closedByHome: false };
}
