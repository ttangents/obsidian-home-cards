/**
 * The Home workspace view.
 *
 * Built as a stable shell around a replaceable body. The header (greeting,
 * dateline, filter box, view toggle, background picker) is created once
 * per open and only
 * updated afterwards, so the filter keeps its focus and caret, the chosen
 * layout survives, and the greeting drawn at open does not re-roll every
 * time a note is saved. `refresh()` recomposes the cards off-screen and
 * swaps them in with one DOM operation, so a metadata event never flashes
 * a loading state over a page that is already showing.
 *
 * The same view draws a folder page. The folder lives in the view's state,
 * so a folder page is a tab of its own, survives a restart, and follows
 * its folder when the folder is renamed. The home page is the view with no
 * folder.
 */

import {
  ItemView,
  setIcon,
  setTooltip,
  TFolder,
  type HoverParent,
  type HoverPopover,
  type ViewStateResult,
  type WorkspaceLeaf,
} from "obsidian";
import { composeSections, type ComposedSection } from "../compose/compose";
import { greetingFor, withName } from "../compose/greeting";
import type HomeCardsPlugin from "../main";
import { folderName, isInside, normalizeFolderPath, reparent } from "../settings/folder-pages";
import { sectionTitle, VIEW_MODES, type ViewMode } from "../settings/schema";
import { applyAppearance } from "./appearance";
import { createNote, cardActions, rediscoverNote } from "./actions";
import { renderSection, settleDek, type CardActions } from "./card";
import { observeDeks } from "./lazy-deks";
import { renderBackgroundPicker, type BackgroundPicker } from "./swatches";

export const VIEW_TYPE_HOME = "home-cards-view";

/** One turn of the Recompose icon; see .hc-reload.is-spinning. */
const RECOMPOSE_SPIN_MS = 600;

/** Local-storage key for the ids of folded sections. */
const COLLAPSED_KEY = "home-cards-collapsed";

interface Shell {
  root: HTMLElement;
  greeting: HTMLElement;
  dateline: HTMLElement;
  toggles: Map<ViewMode, HTMLElement>;
  pickerToggle: HTMLElement;
  /** Opens the folder page's settings; shown on folder pages only. */
  pageSettings: HTMLElement;
  body: HTMLElement;
}

/** The open background picker: its panel and its swatch grid. */
interface OpenPicker {
  panel: HTMLElement;
  grid: BackgroundPicker;
}

export class HomeView extends ItemView implements HoverParent {
  /** The open hover preview, if any; Obsidian manages it. */
  hoverPopover: HoverPopover | null = null;
  private shell: Shell | null = null;
  private mode: ViewMode;
  private greeting = "";
  private query = "";
  private picker: OpenPicker | null = null;
  /** Cards revealed by "See more", by section id; survives recomposes. */
  private readonly revealed = new Map<string, number>();
  private disposeDeks: (() => void) | null = null;
  private readonly actions: CardActions;
  /** Invalidates composes that finish after a newer one or a close. */
  private generation = 0;
  /** Vault path of the folder this page shows; "" for the home page. */
  private folder = "";

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: HomeCardsPlugin
  ) {
    super(leaf);
    this.mode = plugin.settings.defaultView;
    this.actions = cardActions(this.app, this, this, VIEW_TYPE_HOME);
  }

  getViewType(): string {
    return VIEW_TYPE_HOME;
  }

  getDisplayText(): string {
    return this.folder ? folderName(this.folder) : "Home";
  }

  getIcon(): string {
    return this.folder ? "folder-open" : "layout-grid";
  }

  /** The folder goes into the saved layout, so the tab returns after a restart. */
  getState(): Record<string, unknown> {
    return this.folder ? { folder: this.folder } : {};
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const raw = (state as { folder?: unknown } | null)?.folder;
    const next = typeof raw === "string" ? normalizeFolderPath(raw) : "";
    await super.setState(state, result);
    if (next === this.folder) return;
    this.folder = next;
    // A page of another folder starts fresh: its own "See more" reach.
    this.revealed.clear();
    await this.refresh();
  }

  async onOpen(): Promise<void> {
    this.greeting = this.pickGreeting();
    this.shell = this.buildShell(this.contentEl);
    this.registerEvent(this.plugin.onRefresh(() => void this.refresh()));
    // A folder page follows its folder. Setting the state renames the tab.
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (!this.folder || !(file instanceof TFolder)) return;
        const next = reparent(this.folder, oldPath, file.path);
        if (next === this.folder) return;
        void this.leaf.setViewState({ type: VIEW_TYPE_HOME, state: { folder: next } });
      })
    );

    // The picker closes on a press outside it or on Escape. Registered
    // once for the view's life; each handler is a no-op while it is shut.
    const doc = this.contentEl.ownerDocument;
    this.registerDomEvent(doc, "pointerdown", (evt) => {
      const target = evt.target as Node | null;
      if (!this.picker || !target) return;
      if (this.picker.panel.contains(target) || this.shell?.pickerToggle.contains(target)) return;
      this.closePicker();
    });
    this.registerDomEvent(doc, "keydown", (evt) => {
      if (evt.key !== "Escape" || !this.picker) return;
      evt.preventDefault();
      this.closePicker();
      this.shell?.pickerToggle.focus();
    });

    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.closePicker();
    this.disposeDeks?.();
    this.disposeDeks = null;
    this.generation++;
    this.shell = null;
    this.contentEl.empty();
  }

  /** Re-read settings and recompose. Safe to call at any time. */
  async refresh(): Promise<void> {
    const shell = this.shell;
    if (!shell) return;
    applyAppearance(shell.root, this.plugin);
    this.paintHeader(shell);
    this.picker?.grid.paint();
    await this.recompose(shell);
  }

  // ------------------------------------------------------------- header

  private buildShell(container: HTMLElement): Shell {
    const root = container.createDiv({ cls: "home-cards" });
    const wrap = root.createDiv({ cls: "hc-wrap" });
    const top = wrap.createDiv({ cls: "hc-top" });

    const masthead = top.createDiv({ cls: "hc-masthead" });
    const greeting = masthead.createEl("h1", { cls: "hc-greeting" });
    const dateline = masthead.createDiv({ cls: "hc-dateline" });

    const controls = top.createDiv({ cls: "hc-controls" });
    const search = controls.createEl("input", {
      cls: "hc-search",
      attr: { type: "search", placeholder: "Filter notes…", spellcheck: "false" },
    });
    search.addEventListener("input", () => {
      this.query = search.value;
      this.applyFilter();
    });

    // One control cluster: the layout glyphs, a hairline, then the
    // background picker and recompose. Each button names itself in an
    // Obsidian tooltip, which also sets its aria-label.
    const seg = controls.createDiv({ cls: "hc-seg" });
    const button = (label: string, icon: string, cls?: string) => {
      const btn = seg.createEl("button", cls ? { cls } : {});
      setIcon(btn, icon);
      setTooltip(btn, label, { placement: "bottom" });
      return btn;
    };
    const toggles = new Map<ViewMode, HTMLElement>();
    for (const mode of VIEW_MODES) {
      const btn = button(`${mode.label} view`, mode.icon);
      btn.addEventListener("click", () => this.setMode(mode.id));
      toggles.set(mode.id, btn);
    }
    seg.createSpan({ cls: "hc-seg-divider", attr: { "aria-hidden": "true" } });
    const action = (cls: string, label: string, icon: string, run: (newLeaf: boolean) => void) => {
      const btn = button(label, icon, cls);
      btn.addEventListener("click", (evt) => run(evt.metaKey || evt.ctrlKey));
      return btn;
    };
    action("hc-new-note", "New note", "square-pen", (newLeaf) => void createNote(this.app, newLeaf, this.folder));
    action("hc-rediscover", "Rediscover a note", "shuffle", (newLeaf) =>
      rediscoverNote(this.app, this.plugin.settings, newLeaf, this.folder)
    );
    const pageSettings = action("hc-page-settings", "Page settings", "sliders-horizontal", () =>
      this.plugin.editFolderPage(this.folder)
    );
    const pickerToggle = button("Background", "swatch-book", "hc-picker-toggle");
    pickerToggle.setAttrs({ "aria-haspopup": "dialog", "aria-expanded": "false" });
    // Older Obsidian builds ship a Lucide set without swatch-book.
    if (!pickerToggle.firstElementChild) setIcon(pickerToggle, "palette");
    pickerToggle.addEventListener("click", () => {
      if (this.picker) this.closePicker();
      else this.openPicker(controls, pickerToggle);
    });
    const recompose = button("Recompose", "refresh-cw", "hc-reload");
    recompose.addEventListener("click", () => void this.recomposeNow(recompose));

    const body = wrap.createDiv({ cls: "hc-body" });
    body.createDiv({ cls: "hc-loading", text: "Composing…" });

    const shell = { root, greeting, dateline, toggles, pickerToggle, pageSettings, body };
    this.paintMode(shell);
    return shell;
  }

  private paintHeader(shell: Shell): void {
    const s = this.plugin.settings;
    const folder = this.folder;
    shell.pageSettings.toggle(folder !== "");

    // A folder page is titled by its folder, whatever the greeting setting
    // says: the title is what tells its tab from the home page.
    shell.greeting.toggle(folder !== "" || s.greetingEnabled);
    shell.greeting.setText(folder ? folderName(folder) : withName(this.greeting, s.greetingName));

    // A folder page's dateline places it: the folders above it, when it has any.
    const above = folder.split("/").slice(0, -1).join(" / ");
    const bits: string[] = [];
    if (!folder) {
      bits.push(
        new Date().toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
    } else if (above) {
      bits.push(above);
    }
    if (s.showNoteCount || folder) {
      const count = this.app.vault.getMarkdownFiles().filter((f) => isInside(f.path, folder)).length;
      bits.push(`${count} ${count === 1 ? "note" : "notes"}`);
    }
    shell.dateline.setText(bits.join("  ·  "));
  }

  /**
   * Open the background picker under the header controls. A pick applies
   * to this page at once and stays open, so patterns can be compared;
   * the plugin then saves it and redraws every other open view.
   */
  private openPicker(controls: HTMLElement, toggle: HTMLElement): void {
    const root = this.shell?.root;
    if (!root) return;
    const panel = controls.createDiv({
      cls: "hc-picker",
      attr: { role: "dialog", "aria-label": "Background" },
    });
    const grid = renderBackgroundPicker(panel, this.plugin, () => applyAppearance(root, this.plugin));
    this.picker = { panel, grid };
    toggle.addClass("is-active");
    toggle.setAttr("aria-expanded", "true");
    panel.querySelector<HTMLElement>(".hc-swatch-item.is-selected")?.focus();
  }

  private closePicker(): void {
    if (!this.picker) return;
    this.picker.panel.remove();
    this.picker = null;
    const toggle = this.shell?.pickerToggle;
    toggle?.removeClass("is-active");
    toggle?.setAttr("aria-expanded", "false");
  }

  /**
   * The Recompose button: a fresh greeting and fresh cards. The icon
   * spins for at least one turn, so a click always shows it registered,
   * even when the cards come back unchanged.
   */
  private async recomposeNow(button: HTMLElement): Promise<void> {
    if (button.hasClass("is-spinning")) return;
    button.addClass("is-spinning");
    const minimum = new Promise((resolve) => window.setTimeout(resolve, RECOMPOSE_SPIN_MS));
    this.greeting = this.pickGreeting();
    try {
      await Promise.all([this.refresh(), minimum]);
    } finally {
      button.removeClass("is-spinning");
    }
  }

  /** A greeting for this moment, drawn from the built-in list. */
  private pickGreeting(): string {
    return greetingFor(new Date(), { occasions: this.plugin.settings.greetingOccasions });
  }

  /** Layout switches are pure CSS: no recompose, no network of listeners. */
  private setMode(mode: ViewMode): void {
    this.mode = mode;
    if (this.shell) this.paintMode(this.shell);
  }

  private paintMode(shell: Shell): void {
    shell.root.dataset.view = this.mode;
    for (const [mode, btn] of shell.toggles) {
      const on = mode === this.mode;
      btn.toggleClass("is-active", on);
      btn.setAttr("aria-pressed", String(on));
    }
  }

  // --------------------------------------------------------------- body

  private async recompose(shell: Shell): Promise<void> {
    const token = ++this.generation;
    const { app, plugin, folder } = this;
    const settings = plugin.settings;

    // A folder that was deleted or moved away leaves its tab behind.
    if (folder && !app.vault.getFolderByPath(folder)) {
      this.disposeDeks?.();
      this.disposeDeks = null;
      shell.body.replaceChildren();
      shell.body.createDiv({ cls: "hc-empty", text: "This folder no longer exists." });
      return;
    }

    let sections: ComposedSection[];
    try {
      sections = await composeSections(app, settings, {
        deks: (file) => plugin.dekCache.get(app, file, settings),
        opened: plugin.openHistory.list(),
        folder,
      });
    } catch (err) {
      console.error("Home Cards: compose failed", err);
      if (token === this.generation) {
        shell.body.empty();
        shell.body.createDiv({
          cls: "hc-empty",
          text: "Could not compose the page. See the console for details.",
        });
      }
      return;
    }
    // A newer compose, or a close, happened while files were being read.
    if (token !== this.generation) return;

    // A folder narrows every section, so many come up empty there; the page
    // shows the ones that have cards. The home page keeps its empty ones,
    // which tell the reader why a section is bare.
    if (folder) sections = sections.filter((s) => s.cards.length > 0);

    // Built detached, then swapped in whole: no intermediate empty state.
    const next = createDiv();
    const hasNotes = app.vault.getMarkdownFiles().some((f) => isInside(f.path, folder));
    if (folder && !hasNotes) {
      // Images and other attachments are not notes, so a folder of only
      // those has nothing to show.
      next.createDiv({ cls: "hc-empty", text: "This folder has no notes yet. Cards appear here as you add them." });
    } else if (!sections.length) {
      next.createDiv({
        cls: "hc-empty",
        text: folder
          ? "No notes in this folder match this page's sections."
          : "Turn on a section in Settings → Home Cards to fill this page.",
      });
    } else if (!hasNotes) {
      // A new vault: one line beats a column of empty sections.
      next.createDiv({ cls: "hc-empty", text: "Cards appear here as you write notes." });
    } else {
      const collapsed = new Set(this.collapsedIds());
      for (const { config, cards, more, claimed } of sections) {
        const emptyText = claimed
          ? "Every matching note already appears in a section above."
          : "This section has no matching notes.";
        const el = renderSection(next, sectionTitle(config), cards, settings, this.actions, {
          emptyText,
          more,
          fold: {
            collapsed: collapsed.has(this.foldKey(config.id)),
            onToggle: (now) => this.rememberCollapsed(this.foldKey(config.id), now),
          },
          paging: {
            more: () => {
              const shown = this.revealed.get(config.id) ?? cards.length;
              this.revealed.set(config.id, shown + config.count);
              this.applyFilter();
            },
            fewer: () => {
              this.revealed.delete(config.id);
              this.applyFilter();
              // The page just got shorter: keep the buttons in view rather
              // than leaving the reader somewhere further down the page.
              el.find(".hc-more-row")?.scrollIntoView({ block: "nearest" });
            },
          },
        });
        el.dataset.hcSection = config.id;
        el.dataset.hcBase = String(cards.length);
      }
    }
    this.disposeDeks?.();
    shell.body.replaceChildren(...Array.from(next.childNodes));
    this.applyFilter();
    // Held-back cards fetch their deks only once revealed and on screen.
    this.disposeDeks = observeDeks(shell.body, (path, el) => {
      const file = app.vault.getFileByPath(path);
      if (!file) return;
      void plugin.dekCache.get(app, file, plugin.settings).then((dek) => settleDek(el, dek));
    });
  }

  // ------------------------------------------------------- section state

  /**
   * The key a section's folded state is stored under. A folder page keys
   * on its folder as well, so folding "Recently modified" on one page does
   * not fold it on every other; the home page keeps its original keys.
   */
  private foldKey(sectionId: string): string {
    return this.folder ? `${sectionId}@${this.folder}` : sectionId;
  }

  /** Folded sections, by key. Kept per device, in Obsidian's local storage. */
  private collapsedIds(): string[] {
    const stored: unknown = this.app.loadLocalStorage(COLLAPSED_KEY);
    return Array.isArray(stored) ? stored.filter((v): v is string => typeof v === "string") : [];
  }

  private rememberCollapsed(id: string, collapsed: boolean): void {
    const ids = new Set(this.collapsedIds());
    if (collapsed) ids.add(id);
    else ids.delete(id);
    this.app.saveLocalStorage(COLLAPSED_KEY, [...ids]);
  }

  /**
   * Decide which cards show. Unfiltered, a section shows its first cards
   * plus any "See more" has revealed. Filtering searches every card,
   * held back or not, and opens folded sections while the query lasts.
   */
  private applyFilter(): void {
    const body = this.shell?.body;
    if (!body) return;
    const q = this.query.trim().toLowerCase();
    body.toggleClass("is-filtering", q !== "");
    for (const section of body.findAll(".hc-section")) {
      const id = section.dataset.hcSection ?? "";
      const base = Number(section.dataset.hcBase ?? "0");
      const limit = this.revealed.get(id) ?? base;
      const cards = section.findAll(".hc-card");
      let shown = 0;
      for (const card of cards) {
        const index = Number(card.dataset.hcIndex ?? "0");
        const visible = q ? (card.dataset.search ?? "").includes(q) : index < limit;
        card.toggleClass("is-hidden", !visible);
        if (visible) shown++;
      }
      section.find(".hc-count")?.setText(String(shown));
      const canMore = limit < cards.length;
      const canFewer = limit > base;
      section.find(".hc-more")?.toggleClass("is-hidden", !canMore);
      section.find(".hc-less")?.toggleClass("is-hidden", !canFewer);
      section.find(".hc-more-row")?.toggleClass("is-hidden", q !== "" || !(canMore || canFewer));
      // A section the filter emptied is noise. One that was empty to begin
      // with keeps its "no notes" line, which is the useful signal.
      section.toggleClass("is-hidden", q !== "" && shown === 0);
    }
  }
}
