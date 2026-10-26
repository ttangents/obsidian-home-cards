/**
 * "Home cards" as a Bases view type.
 *
 * The query (filters, formulas, sort, groupBy, limit) stays in Bases;
 * this view draws the result as cards, one section per group. A query can
 * return any number of entries, so deks load lazily as cards approach the
 * viewport, through the plugin's shared dek cache.
 */

import { BasesView, type App, type EventRef, type HoverParent, type Plugin, type QueryController } from "obsidian";
import { buildCard, type CardContext } from "../compose/card";
import { iconsFor } from "../compose/compose";
import type { DekCache } from "../compose/dek-cache";
import type { SettingsAccess } from "../settings/store";
import { applyAppearance } from "./appearance";
import { cardActions, type MarkActions } from "./actions";
import type { BackgroundStore } from "./backgrounds";
import { renderSection, settleDek, type CardActions } from "./card";
import { observeDeks } from "./lazy-deks";

export const BASES_VIEW_ID = "home-cards";

/** What the Bases view uses from the rest of the plugin; main.ts supplies it. */
export interface BasesServices {
  store: SettingsAccess;
  marks: MarkActions;
  backgrounds: BackgroundStore;
  dekCache: DekCache;
  /** Subscribe to redraw requests; the view passes the result to `registerEvent`. */
  onRefresh(callback: () => void): EventRef;
}

class HomeCardsBasesView extends BasesView {
  readonly type = BASES_VIEW_ID;
  /** Our own element inside the container Bases hands us. */
  private readonly root: HTMLElement;
  /** Invalidates async renders that land after newer data or an unload. */
  private generation = 0;
  private disposeObserver: (() => void) | null = null;
  /** Holds the hover preview Obsidian opens for a card. */
  private readonly hover: HoverParent = { hoverPopover: null };
  private readonly actions: CardActions;

  constructor(
    controller: QueryController,
    containerEl: HTMLElement,
    private readonly services: BasesServices,
    app: App
  ) {
    super(controller);
    this.root = containerEl.createDiv({ cls: "hc-in-bases" });
    this.actions = cardActions(app, this, this.hover, BASES_VIEW_ID, services.marks);
    // Settings edits redraw the view; the Component releases the handler.
    // Bases fills `data` only once the query first runs, which for a base
    // in a background tab can come after a settings edit.
    this.registerEvent(
      services.onRefresh(() => {
        if (this.hasData()) this.onDataUpdated();
      })
    );
  }

  onunload(): void {
    this.generation++;
    this.stopObserving();
    this.root.remove();
  }

  /**
   * Bases calls this on every query re-run and replaces `this.data`
   * wholesale, so the view keeps nothing from a previous run.
   */
  onDataUpdated(): void {
    const token = ++this.generation;
    this.stopObserving();

    // onDataUpdated is synchronous by contract. The async tail checks
    // the token after every await and catches its own failures, so an
    // error never surfaces as an unhandled rejection inside Bases.
    this.render(token).catch((err) => {
      console.error("Home Cards: Bases render failed", err);
      if (token !== this.generation) return;
      this.root.empty();
      this.root.createDiv({
        cls: "hc-empty",
        text: "Could not render this view. See the console for details.",
      });
    });
  }

  /** Whether Bases has delivered a query result yet. */
  private hasData(): boolean {
    return (this.data as typeof this.data | undefined) !== undefined;
  }

  private async render(token: number): Promise<void> {
    if (!this.hasData()) return;
    const { app, services } = this;
    const settings = services.store.settings;
    const groups = this.data.groupedData;

    // No dek source: deks stay null and fill in on scroll.
    const ctx: CardContext = {
      settings,
      cacheOf: (f) => app.metadataCache.getFileCache(f),
      now: new Date(),
      metaKey: "date",
      fields: [],
      image: "none",
      icons: await iconsFor(app, settings),
    };
    const sections = await Promise.all(
      groups.map(async (group) => ({
        title: group.hasKey() ? (group.key?.toString() ?? "") : "",
        cards: await Promise.all(group.entries.map((entry) => buildCard(ctx, entry.file))),
      }))
    );
    if (token !== this.generation) return;

    const root = this.root;
    root.empty();
    applyAppearance(root, settings, services.backgrounds);
    root.dataset.view = "grid";
    for (const { title, cards } of sections) {
      renderSection(root, title, cards, settings, this.actions);
    }

    this.disposeObserver = observeDeks(root, (path, el) => {
      const file = app.vault.getFileByPath(path);
      if (!file) return;
      void services.dekCache.get(app, file, services.store.settings).then((dek) => {
        if (token === this.generation) settleDek(el, dek);
      });
    });
  }

  private stopObserving(): void {
    this.disposeObserver?.();
    this.disposeObserver = null;
  }
}

/** Register the view type. Returns false if Obsidian declines the registration. */
export function registerBasesView(plugin: Plugin, services: BasesServices): boolean {
  return plugin.registerBasesView(BASES_VIEW_ID, {
    name: "Home cards",
    icon: "layout-grid",
    factory: (controller, containerEl) => new HomeCardsBasesView(controller, containerEl, services, plugin.app),
  });
}
