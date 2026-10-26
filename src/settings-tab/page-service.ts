/**
 * Pages as the reader opens, creates and edits them: the page rules that
 * need a tab or an editor. The rules about pages themselves live in
 * settings/pages.ts; the editor in page-modal.ts.
 */

import { Notice } from "obsidian";
import type { PageActions } from "../render/page-actions";
import { VIEW_TYPE_HOME } from "../render/home-view";
import { refFromState, resolvePage, stateFromRef, suggestPageName, uniquePageName, type PageRef } from "../settings/pages";
import { blankScope, LIMITS, newPageId, type NamedPage } from "../settings/schema";
import { PageModal } from "./page-modal";
import type { EditorContext } from "./section-modal";

/** What the reader sees when a vault already has as many pages as Home Cards keeps. */
const TOO_MANY_PAGES = `Home Cards: a vault can have up to ${LIMITS.pages.max} pages.`;

export class PageService implements PageActions {
  constructor(private readonly context: EditorContext) {}

  /**
   * Reveal a page, opening it in a new tab if it is not open. Every page
   * has at most one tab, however it was reached: a folder with a named
   * page opens that page.
   */
  async open(ref: PageRef = {}): Promise<void> {
    const { workspace } = this.context.app;
    const settings = this.context.store.settings;
    const target = resolvePage(settings, ref);
    if (!target) {
      new Notice("Home Cards: that page no longer exists.");
      return;
    }
    // The saved view state names the page even for a tab that Obsidian
    // has not loaded yet, so this never wakes a deferred view.
    const existing = workspace.getLeavesOfType(VIEW_TYPE_HOME).find((leaf) => {
      const open = resolvePage(settings, refFromState(leaf.getViewState().state));
      return open?.key === target.key;
    });
    if (existing) {
      await workspace.revealLeaf(existing);
      // Revealing shows the tab; the keyboard and the commands follow only
      // the active leaf.
      workspace.setActiveLeaf(existing, { focus: true });
      return;
    }
    const leaf = workspace.getLeaf("tab");
    const state = stateFromRef(target.record ? { page: target.record.id } : ref);
    await leaf.setViewState({ type: VIEW_TYPE_HOME, active: true, state });
    await workspace.revealLeaf(leaf);
  }

  /**
   * Open the editor for a new page. Nothing is saved until the editor's
   * Create button; `open` also opens the page in a tab once it exists.
   */
  create({ open, onCreated }: { open: boolean; onCreated?: (page: NamedPage) => void }): void {
    const { store } = this.context;
    if (store.settings.pages.length >= LIMITS.pages.max) {
      new Notice(TOO_MANY_PAGES);
      return;
    }
    const draft: NamedPage = { id: newPageId(), name: "", scope: blankScope(), sections: null, cssClass: "" };
    new PageModal(this.context, draft, "create", (page) => {
      void store.commit().then(async () => {
        onCreated?.(page);
        if (open) await this.open({ page: page.id });
      });
    }).open();
  }

  /**
   * Open the editor for a page. A folder page that has no record gets one
   * for the editor to change, which joins the settings at the first
   * change; if the editor closes untouched, the folder follows the home
   * page as before.
   */
  edit(ref: PageRef): void {
    const { store } = this.context;
    const resolved = resolvePage(store.settings, ref);
    if (!resolved || resolved.isHome || resolved.note) return;
    if (resolved.record) {
      new PageModal(this.context, resolved.record, "edit", () => void store.flush()).open();
      return;
    }
    if (store.settings.pages.length >= LIMITS.pages.max) {
      new Notice(TOO_MANY_PAGES);
      return;
    }
    const page: NamedPage = {
      id: newPageId(),
      name: uniquePageName(store.settings.pages, suggestPageName(resolved.scope)),
      scope: { ...resolved.scope },
      sections: null,
      cssClass: "",
    };
    const join = () => {
      const pages = store.settings.pages;
      if (!pages.some((p) => p.id === page.id)) pages.push(page);
    };
    new PageModal(this.context, page, "edit", () => void store.flush(), join).open();
  }
}
