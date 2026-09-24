/**
 * The Home workspace view.
 *
 * Built as a stable shell around a replaceable body. The header (greeting,
 * dateline, filter box, view toggle) is created once per open and only
 * updated afterwards, so the filter keeps its focus and caret, the chosen
 * layout survives, and the greeting drawn at open does not re-roll every
 * time a note is saved. `refresh()` recomposes the cards off-screen and
 * swaps them in with one DOM operation, so a metadata event never flashes
 * a loading state over a page that is already showing.
 */

import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";
import { composeSections, type ComposedSection } from "../compose/compose";
import { greetingFor } from "../compose/greeting";
import type HomeCardsPlugin from "../main";
import { sectionTitle, VIEW_MODES, type ViewMode } from "../settings/schema";
import { applyAppearance } from "./appearance";
import { noteOpener, renderSection } from "./card";

export const VIEW_TYPE_HOME = "home-cards-view";

interface Shell {
  root: HTMLElement;
  greeting: HTMLElement;
  dateline: HTMLElement;
  toggles: Map<ViewMode, HTMLElement>;
  body: HTMLElement;
}

export class HomeView extends ItemView {
  private shell: Shell | null = null;
  private mode: ViewMode;
  private greeting = "";
  private query = "";
  /** Invalidates composes that finish after a newer one or a close. */
  private generation = 0;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: HomeCardsPlugin
  ) {
    super(leaf);
    this.mode = plugin.settings.defaultView;
  }

  getViewType(): string {
    return VIEW_TYPE_HOME;
  }

  getDisplayText(): string {
    return "Home";
  }

  getIcon(): string {
    return "layout-grid";
  }

  async onOpen(): Promise<void> {
    this.greeting = greetingFor(new Date(), {
      occasions: this.plugin.settings.greetingOccasions,
    });
    this.shell = this.buildShell(this.contentEl);
    this.registerEvent(this.plugin.onRefresh(() => void this.refresh()));
    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.generation++;
    this.shell = null;
    this.contentEl.empty();
  }

  /** Re-read settings and recompose. Safe to call at any time. */
  async refresh(): Promise<void> {
    const shell = this.shell;
    if (!shell) return;
    applyAppearance(shell.root, this.plugin.settings);
    this.paintHeader(shell);
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

    // One control cluster: the layout glyphs, a hairline, recompose.
    // aria-label carries each name, and Obsidian shows it as the tooltip.
    const seg = controls.createDiv({ cls: "hc-seg" });
    const toggles = new Map<ViewMode, HTMLElement>();
    for (const mode of VIEW_MODES) {
      const btn = seg.createEl("button", { attr: { "aria-label": `${mode.label} view` } });
      setIcon(btn, mode.icon);
      btn.addEventListener("click", () => this.setMode(mode.id));
      toggles.set(mode.id, btn);
    }
    const recompose = seg.createEl("button", {
      cls: "hc-reload",
      attr: { "aria-label": "Recompose" },
    });
    setIcon(recompose, "refresh-cw");
    recompose.addEventListener("click", () => void this.refresh());

    const body = wrap.createDiv({ cls: "hc-body" });
    body.createDiv({ cls: "hc-loading", text: "Composing…" });

    const shell = { root, greeting, dateline, toggles, body };
    this.paintMode(shell);
    return shell;
  }

  private paintHeader(shell: Shell): void {
    const s = this.plugin.settings;
    const name = s.greetingName.trim();
    shell.greeting.toggle(s.greetingEnabled);
    shell.greeting.setText(name ? `${this.greeting}, ${name}` : this.greeting);

    const bits = [
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    ];
    if (s.showNoteCount) bits.push(`${this.app.vault.getMarkdownFiles().length} notes`);
    shell.dateline.setText(bits.join("  ·  "));
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
    const { app, plugin } = this;
    const settings = plugin.settings;

    let sections: ComposedSection[];
    try {
      sections = await composeSections(app, settings, (file) =>
        plugin.dekCache.get(app, file, settings)
      );
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

    // Built detached, then swapped in whole: no intermediate empty state.
    const next = createDiv();
    if (!sections.length) {
      next.createDiv({ cls: "hc-empty", text: "Turn on a section in Settings → Home Cards to fill this page." });
    } else if (!app.vault.getMarkdownFiles().length) {
      // A new vault: one line beats a column of empty sections.
      next.createDiv({ cls: "hc-empty", text: "Cards appear here as you write notes." });
    } else {
      const open = noteOpener(app);
      for (const { config, cards, claimed } of sections) {
        const empty = claimed
          ? "Every matching note already appears in a section above."
          : "This section has no matching notes.";
        renderSection(next, sectionTitle(config), cards, settings, open, empty);
      }
    }
    shell.body.replaceChildren(...Array.from(next.childNodes));
    this.applyFilter();
  }

  private applyFilter(): void {
    const body = this.shell?.body;
    if (!body) return;
    const q = this.query.trim().toLowerCase();
    for (const section of body.findAll(".hc-section")) {
      const cards = section.findAll(".hc-card");
      let shown = 0;
      for (const card of cards) {
        const hit = !q || (card.dataset.search ?? "").includes(q);
        card.toggleClass("is-hidden", !hit);
        if (hit) shown++;
      }
      section.find(".hc-count")?.setText(String(shown));
      // A section the filter emptied is noise. One that was empty to begin
      // with keeps its "no notes" line, which is the useful signal.
      section.toggleClass("is-hidden", q !== "" && shown === 0);
    }
  }
}
