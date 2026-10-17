/**
 * A searchable list of the home page and every named page, for the
 * command that opens one without a command of its own.
 */

import { FuzzySuggestModal, type FuzzyMatch } from "obsidian";
import type HomeCardsPlugin from "../main";
import { scopeSummary, type PageRef } from "../settings/pages";

interface PageChoice {
  ref: PageRef;
  title: string;
  /** A line under the title: what the page is about. */
  note: string;
}

class PagePicker extends FuzzySuggestModal<PageChoice> {
  constructor(private readonly plugin: HomeCardsPlugin) {
    super(plugin.app);
    this.setPlaceholder("Choose a page");
  }

  getItems(): PageChoice[] {
    const pages = this.plugin.settings.pages.map((page) => ({
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
    void this.plugin.activateView(choice.ref);
  }
}

/** Open the picker; the chosen page opens in its tab. */
export function pickPage(plugin: HomeCardsPlugin): void {
  new PagePicker(plugin).open();
}
