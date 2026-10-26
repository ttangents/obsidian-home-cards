/**
 * A searchable list of the home page and every named page, for the
 * command that opens one without a command of its own.
 */

import { FuzzySuggestModal, type App, type FuzzyMatch } from "obsidian";
import { scopeSummary, type PageRef } from "../settings/pages";
import type { SettingsAccess } from "../settings/store";
import type { PageActions } from "./page-actions";

interface PageChoice {
  ref: PageRef;
  title: string;
  /** A line under the title: what the page is about. */
  note: string;
}

class PagePicker extends FuzzySuggestModal<PageChoice> {
  constructor(
    app: App,
    private readonly store: SettingsAccess,
    private readonly pages: PageActions
  ) {
    super(app);
    this.setPlaceholder("Choose a page");
  }

  getItems(): PageChoice[] {
    const pages = this.store.settings.pages.map((page) => ({
      ref: { page: page.id },
      title: page.name,
      note: scopeSummary(page.scope),
    }));
    return [{ ref: {}, title: "Home", note: "The home page" }, ...pages];
  }

  getItemText(choice: PageChoice): string {
    return choice.title;
  }

  renderSuggestion(match: FuzzyMatch<PageChoice>, el: HTMLElement): void {
    super.renderSuggestion(match, el);
    el.find(".suggestion-content")?.createDiv({ cls: "suggestion-note", text: match.item.note });
  }

  onChooseItem(choice: PageChoice): void {
    void this.pages.open(choice.ref);
  }
}

/** Open the picker; the chosen page opens in its tab. */
export function pickPage(app: App, store: SettingsAccess, pages: PageActions): void {
  new PagePicker(app, store, pages).open();
}
