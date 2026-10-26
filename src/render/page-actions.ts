/**
 * What views and editors can do with pages. The settings tab's page
 * service implements it (settings-tab/page-service.ts), since creating and
 * editing a page open its editor; the home view and the page picker,
 * which sit below the settings tab, reach it through this interface.
 */

import type { PageRef } from "../settings/pages";
import type { NamedPage } from "../settings/schema";

export interface PageActions {
  /**
   * Reveal a page, opening it in a new tab if it is not open. Every page
   * has at most one tab, however it was reached.
   */
  open(ref?: PageRef): Promise<void>;
  /** Open the editor for a page; the home page and a note's page have none. */
  edit(ref: PageRef): void;
  /** Open the editor for a new page; `open` also opens it once it exists. */
  create(options: { open: boolean; onCreated?: (page: NamedPage) => void }): void;
}
