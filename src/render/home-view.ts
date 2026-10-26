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
 * The same view draws every page. Which page it shows lives in the view's
 * state (see settings/pages.ts), so each page is a tab of its own, returns
 * after a restart, and a folder page follows its folder when the folder is
 * renamed. The home page is the view with no reference.
 */

import {
  ItemView,
  Notice,
  Scope,
  setIcon,
  setTooltip,
  TFile,
  TFolder,
  type EventRef,
  type HoverParent,
  type HoverPopover,
  type PaneType,
  type ViewStateResult,
  type WorkspaceLeaf,
} from "obsidian";
import type { ActivityFacts } from "../compose/activity";
import { composePage, type ComposedPage } from "../compose/compose";
import type { DekCache } from "../compose/dek-cache";
import { greetingFor, withName } from "../compose/greeting";
import { compilePageScope, type ScopeTest } from "../compose/scope";
import { pageGone, planPage, type PagePlan } from "../compose/plan";
import { relateView, type RelateConnection } from "../compose/relate";
import { cssClassList } from "../settings/css-classes";
import { reparent } from "../settings/folders";
import {
  refFromState,
  resolvePage,
  sameRef,
  scopeSummary,
  stateFromRef,
  type PageRef,
  type ResolvedPage,
} from "../settings/pages";
import { VIEW_MODES, type ViewMode } from "../settings/schema";
import type { SettingsAccess } from "../settings/store";
import { applyAppearance } from "./appearance";
import { applyTemplate, createNote, cardActions, rediscoverNote, type MarkActions } from "./actions";
import type { BackgroundStore } from "./backgrounds";
import type { PageActions } from "./page-actions";
import type { ReleaseNotices } from "./release-notices";
import { paneFor, renderSection, settleDek, type CardActions, type SectionMove } from "./card";
import { templateForScope, type NoteTemplate } from "../compose/templates";
import { registerCardKeys } from "./keyboard";
import { observeDeks } from "./lazy-deks";
import { renderBackgroundPicker, type BackgroundPicker } from "./swatches";
import { renderUpdateNotice } from "./whats-new";

export const VIEW_TYPE_HOME = "home-cards-view";

/** What the home view uses from the rest of the plugin; main.ts supplies it. */
export interface HomeServices {
  store: SettingsAccess;
  pages: PageActions;
  marks: MarkActions;
  backgrounds: BackgroundStore;
  dekCache: DekCache;
  /** The plugin's longer memory of opened notes; see compose/open-history.ts. */
  openHistory: { list(): readonly string[] };
  activity: ActivityFacts;
  relate: RelateConnection;
  releases: ReleaseNotices;
  /** Subscribe to redraw requests; the view passes the result to `registerEvent`. */
  onRefresh(callback: () => void): EventRef;
}

/** One turn of the Recompose icon; see .hc-reload.is-spinning. */
const RECOMPOSE_SPIN_MS = 600;

/** Local-storage key for the ids of folded sections. */
const COLLAPSED_KEY = "home-cards-collapsed";

interface Shell {
  root: HTMLElement;
  search: HTMLInputElement;
  greeting: HTMLElement;
  dateline: HTMLElement;
  toggles: Map<ViewMode, HTMLElement>;
  pickerToggle: HTMLElement;
  /** Opens the page's settings; shown on every page but the home page. */
  pageSettings: HTMLElement;
  /** The home page's notice after an update; see whats-new.ts. */
  notice: HTMLElement;
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
  /** Which page this view shows; empty for the home page. */
  private ref: PageRef = {};
  /** The tab title and icon last handed to Obsidian; see syncTab. */
  private tabLook = "";
  /** The page's custom classes now on the root; see paintStyleHooks. */
  private pageClasses: string[] = [];
  /** True while Obsidian is setting this view's state, which updates the tab itself. */
  private settingState = false;
  /** False until Obsidian first hands the view its state; see getDisplayText. */
  private stateApplied = false;
  /** The releases the notice shows now, by version; redrawn only when they change. */
  private noticeFor = "";
  /** The note count the last compose of a page found, for the header. */
  private counted: { key: string; notes: number } | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly services: HomeServices
  ) {
    super(leaf);
    this.mode = services.store.settings.defaultView;
    this.actions = cardActions(this.app, this, this, VIEW_TYPE_HOME, services.marks);
  }

  getViewType(): string {
    return VIEW_TYPE_HOME;
  }

  /** The page this view shows now, or null when its named page was deleted. */
  private page(): ResolvedPage | null {
    return resolvePage(this.services.store.settings, this.ref);
  }

  /**
   * Obsidian writes the title in the view's own header once, when it opens
   * the view and before it sets the view's state, and offers no public way
   * to change it later. Until the state arrives the view names itself, so
   * that header reads "Home Cards" on every page; the tab, which Obsidian
   * reads again after the state is set, shows the page.
   */
  getDisplayText(): string {
    if (!this.stateApplied) return "Home Cards";
    return this.page()?.title ?? "Missing page";
  }

  getIcon(): string {
    return this.page()?.icon ?? "layout-grid";
  }

  /** The page goes into the saved layout, so the tab returns after a restart. */
  getState(): Record<string, unknown> {
    return stateFromRef(this.ref);
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const next = refFromState(state);
    this.stateApplied = true;
    await super.setState(state, result);
    if (sameRef(next, this.ref)) return;
    this.ref = next;
    // Another page starts fresh: its own "See more" reach.
    this.revealed.clear();
    this.settingState = true;
    try {
      await this.refresh();
    } finally {
      this.settingState = false;
    }
  }

  async onOpen(): Promise<void> {
    this.greeting = this.pickGreeting();
    this.shell = this.buildShell(this.contentEl);
    this.registerEvent(this.services.onRefresh(() => void this.refresh()));
    // A folder page follows its folder, and a note's page its note.
    // Setting the state renames the tab.
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (this.ref.note && file instanceof TFile && this.ref.note === oldPath) {
          void this.leaf.setViewState({ type: VIEW_TYPE_HOME, state: { note: file.path } });
          return;
        }
        const folder = this.ref.folder;
        if (!folder || !(file instanceof TFolder)) return;
        const next = reparent(folder, oldPath, file.path);
        if (next === folder) return;
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

    // Keys work while this page has focus, through its own scope.
    this.scope = new Scope(this.app.scope);
    registerCardKeys(this.scope, () => this.shell?.body ?? null, {
      focusSearch: () => this.shell?.search.focus(),
      preview: (card) => {
        const file = this.app.vault.getFileByPath(card.dataset.hcPath ?? "");
        if (file) this.actions.hover?.preview(file, card);
      },
      togglePin: (path) => this.services.marks.togglePin(path),
    });

    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.closePicker();
    this.disposeDeks?.();
    this.disposeDeks = null;
    this.generation++;
    this.noticeFor = "";
    this.counted = null;
    this.pageClasses = [];
    this.shell = null;
    this.contentEl.empty();
  }

  /** Re-read settings and recompose. Safe to call at any time. */
  async refresh(): Promise<void> {
    const shell = this.shell;
    if (!shell) return;
    applyAppearance(shell.root, this.services.store.settings, this.services.backgrounds);
    // Resolved once, so the header and the body agree.
    const page = this.page();
    this.paintStyleHooks(shell.root, page);
    const test = page && !page.note ? compilePageScope(page.scope) : null;
    this.syncTab(page);
    // The compose counts the page's notes in its one walk of the vault;
    // until it does, the header keeps the count it showed for this page.
    this.paintHeader(shell, page, page && this.counted?.key === page.key ? this.counted.notes : null);
    this.paintNotice(shell, page);
    this.picker?.grid.paint();
    await this.recompose(shell, page, test);
  }

  /**
   * The page's styling hooks on the root: `data-page` says which kind of
   * page it is, and a named page adds its custom classes. Both are part of
   * the documented styling contract; see docs/STYLING.md.
   */
  private paintStyleHooks(root: HTMLElement, page: ResolvedPage | null): void {
    root.dataset.page = !page ? "missing" : page.isHome ? "home" : page.note ? "note" : "page";
    const classes = cssClassList(page?.record?.cssClass ?? "");
    if (classes.join(" ") === this.pageClasses.join(" ")) return;
    root.removeClasses(this.pageClasses);
    root.addClasses(classes);
    this.pageClasses = classes;
  }

  /**
   * Keep the tab in step with the page. Obsidian reads a tab's title and
   * icon when a view's state is set, so after a rename or a change of scope
   * the same state is set again.
   */
  private syncTab(page: ResolvedPage | null): void {
    const title = page?.title ?? "Missing page";
    const look = `${title}\n${page?.icon ?? ""}`;
    if (look === this.tabLook) return;
    const first = this.tabLook === "";
    this.tabLook = look;
    if (!first && !this.settingState) {
      void this.leaf.setViewState({ type: VIEW_TYPE_HOME, state: this.getState() });
    }
  }

  // ------------------------------------------------------------- header

  private buildShell(container: HTMLElement): Shell {
    const root = container.createDiv({ cls: "home-cards" });
    const wrap = root.createDiv({ cls: "hc-wrap" });
    const top = wrap.createDiv({ cls: "hc-top" });

    const masthead = top.createDiv({ cls: "hc-masthead" });
    const greeting = masthead.createEl("h1", { cls: "hc-greeting" });
    // On a note's page the title opens the note.
    const openNote = (evt: MouseEvent | KeyboardEvent) => {
      const note = this.page()?.note;
      const file = note ? this.app.vault.getFileByPath(note) : null;
      if (file) void this.app.workspace.getLeaf(paneFor(evt)).openFile(file);
    };
    greeting.addEventListener("click", openNote);
    greeting.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") openNote(evt);
    });
    const dateline = masthead.createDiv({ cls: "hc-dateline" });

    const controls = top.createDiv({ cls: "hc-controls" });
    const search = controls.createEl("input", {
      cls: "hc-search",
      attr: { type: "search", placeholder: "Filter notes…", spellcheck: "false" },
    });
    search.setAttr("aria-keyshortcuts", "/");
    search.addEventListener("input", () => {
      this.query = search.value;
      this.applyFilter();
    });
    // Escape clears the filter, then gives the keys back to the cards.
    search.addEventListener("keydown", (evt) => {
      if (evt.key !== "Escape") return;
      if (search.value) {
        search.value = "";
        this.query = "";
        this.applyFilter();
      } else {
        search.blur();
        this.shell?.body.find(".hc-card:not(.is-hidden)")?.focus();
      }
      evt.preventDefault();
    });

    // Three weights, left to right: the filter, which earns its width;
    // the layout switch, one compact segmented control; then the page
    // actions as plain icons in Obsidian's own clickable-icon style,
    // quieter than both. Each button names itself in an Obsidian
    // tooltip, which also sets its aria-label.
    const seg = controls.createDiv({ cls: "hc-seg" });
    const tools = controls.createDiv({ cls: "hc-tools" });
    const button = (parent: HTMLElement, label: string, icon: string, cls?: string) => {
      const btn = parent.createEl("button", cls ? { cls } : {});
      setIcon(btn, icon);
      setTooltip(btn, label, { placement: "bottom" });
      return btn;
    };
    const toggles = new Map<ViewMode, HTMLElement>();
    for (const mode of VIEW_MODES) {
      const btn = button(seg, `${mode.label} view`, mode.icon);
      btn.addEventListener("click", () => this.setMode(mode.id));
      toggles.set(mode.id, btn);
    }
    const action = (cls: string, label: string, icon: string, run: (where: PaneType | false) => void) => {
      const btn = button(tools, label, icon, `${cls} clickable-icon`);
      btn.addEventListener("click", (evt) => run(paneFor(evt)));
      return btn;
    };
    action("hc-new-note", "New note", "square-pen", (where) => {
      const page = this.page();
      void createNote(this.app, where, page ? templateForScope(page.scope) : undefined);
    });
    action("hc-rediscover", "Rediscover a note", "shuffle", (where) => {
      const page = this.page();
      rediscoverNote(this.app, this.services.store.settings, where, page ? compilePageScope(page.scope) : null);
    });
    const pageSettings = action("hc-page-settings", "Page settings", "sliders-horizontal", () =>
      this.services.pages.edit(this.ref)
    );
    const pickerToggle = button(tools, "Background", "swatch-book", "hc-picker-toggle clickable-icon");
    pickerToggle.setAttrs({ "aria-haspopup": "dialog", "aria-expanded": "false" });
    // Older Obsidian builds ship a Lucide set without swatch-book.
    if (!pickerToggle.firstElementChild) setIcon(pickerToggle, "palette");
    pickerToggle.addEventListener("click", () => {
      if (this.picker) this.closePicker();
      else this.openPicker(controls, pickerToggle);
    });
    const recompose = button(tools, "Recompose", "refresh-cw", "hc-reload clickable-icon");
    recompose.addEventListener("click", () => void this.recomposeNow(recompose));

    const notice = wrap.createDiv({ cls: "hc-update" });
    notice.hide();

    const body = wrap.createDiv({ cls: "hc-body" });
    body.createDiv({ cls: "hc-loading", text: "Composing…" });

    const shell = { root, search, greeting, dateline, toggles, pickerToggle, pageSettings, notice, body };
    this.paintMode(shell);
    return shell;
  }

  private paintHeader(shell: Shell, page: ResolvedPage | null, count: number | null): void {
    const s = this.services.store.settings;
    const home = page?.isHome ?? false;
    // A note's page has no settings: its sections follow the note.
    shell.pageSettings.toggle(page !== null && !home && !page.note);

    // Any other page is titled by its name, whatever the greeting setting
    // says: the title is what tells its tab from the home page.
    shell.greeting.toggle(!home || s.greetingEnabled);
    shell.greeting.setText(home ? withName(this.greeting, s.greetingName) : (page?.title ?? "Missing page"));
    const linked = !!page?.note;
    shell.greeting.toggleClass("is-note-link", linked);
    if (linked) shell.greeting.setAttrs({ role: "link", tabindex: "0", "aria-label": `Open ${page?.title ?? "the note"}` });
    else for (const a of ["role", "tabindex", "aria-label"]) shell.greeting.removeAttribute(a);

    const bits: string[] = [];
    if (home) {
      bits.push(
        new Date().toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
    } else if (page) {
      const where = datelineScope(page);
      if (where) bits.push(where);
    }
    if (page && count !== null && (s.showNoteCount || !home)) bits.push(`${count} ${count === 1 ? "note" : "notes"}`);
    shell.dateline.setText(bits.join("  ·  "));
  }

  /**
   * The notice after an update, on the home page only: other pages are
   * about their notes, and the home page is where a reader starts.
   */
  private paintNotice(shell: Shell, page: ResolvedPage | null): void {
    const { store, releases } = this.services;
    const notes = page?.isHome && store.settings.showReleaseNotes ? releases.notes : [];
    const key = notes.map((n) => n.version).join(" ");
    if (key === this.noticeFor) return;
    this.noticeFor = key;
    shell.notice.toggle(notes.length > 0);
    renderUpdateNotice(shell.notice, notes, {
      open: () => releases.show(),
      dismiss: () => releases.dismiss(),
    });
  }

  /**
   * Open the background picker under the header controls. A pick applies
   * to this page at once and stays open, so patterns can be compared;
   * the store then saves it and the plugin redraws every other open view.
   */
  private openPicker(controls: HTMLElement, toggle: HTMLElement): void {
    const root = this.shell?.root;
    if (!root) return;
    const panel = controls.createDiv({
      cls: "hc-picker",
      attr: { role: "dialog", "aria-label": "Background" },
    });
    const { store, backgrounds } = this.services;
    const grid = renderBackgroundPicker(panel, store, backgrounds, () => applyAppearance(root, store.settings, backgrounds));
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
    return greetingFor(new Date(), { occasions: this.services.store.settings.greetingOccasions });
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

  private async recompose(shell: Shell, page: ResolvedPage | null, test: ScopeTest | null): Promise<void> {
    const token = ++this.generation;
    const { app, services } = this;
    const settings = services.store.settings;

    // A deleted page, or a folder that was deleted or moved away, leaves
    // its tab behind with a line saying so.
    const gone = pageGone(page, {
      noteExists: (path) => !!app.vault.getFileByPath(path),
      folderExists: (path) => !!app.vault.getFolderByPath(path),
    });
    if (!page || gone) {
      this.counted = null;
      this.paintHeader(shell, page, null);
      this.showLine(shell, gone ?? "This page no longer exists.");
      return;
    }

    const relate = services.relate.api;
    let composed: ComposedPage;
    try {
      composed = await composePage(app, settings, {
        deks: (file) => services.dekCache.get(app, file, settings),
        opened: services.openHistory.list(),
        activity: services.activity,
        sections: page.sections,
        scope: test,
        relate,
        searches: services.relate.searches,
        note: page.note,
      });
    } catch (err) {
      console.error("Home Cards: compose failed", err);
      if (token === this.generation) this.showLine(shell, "Could not compose the page. See the console for details.");
      return;
    }
    // A newer compose, or a close, happened while files were being read.
    if (token !== this.generation) return;
    if (this.counted?.key !== page.key || this.counted.notes !== composed.notes) {
      this.counted = { key: page.key, notes: composed.notes };
      this.paintHeader(shell, page, composed.notes);
    }

    const plan = planPage(page, composed, {
      noteExists: (path) => !!app.vault.getFileByPath(path),
      folderExists: (path) => !!app.vault.getFolderByPath(path),
      relate: relate ? relateView(relate, new Map()) : null,
      relateStatus: services.relate.status,
      now: new Date(),
    });
    // Built detached, then swapped in whole: no intermediate empty state.
    const next = createDiv();
    if (plan.kind === "empty") next.createDiv({ cls: "hc-empty", text: plan.text });
    else this.drawSections(next, page, plan);
    this.disposeDeks?.();
    shell.body.replaceChildren(...Array.from(next.childNodes));
    this.applyFilter();
    // Held-back cards fetch their deks only once revealed and on screen.
    this.disposeDeks = observeDeks(shell.body, (path, el) => {
      const file = app.vault.getFileByPath(path);
      if (!file) return;
      void services.dekCache.get(app, file, services.store.settings).then((dek) => settleDek(el, dek));
    });
  }

  /** Replace the body with one line, such as why the page cannot show. */
  private showLine(shell: Shell, text: string): void {
    this.disposeDeks?.();
    this.disposeDeks = null;
    shell.body.replaceChildren();
    shell.body.createDiv({ cls: "hc-empty", text });
  }

  /** Draw the plan's sections into `parent`. */
  private drawSections(parent: HTMLElement, page: ResolvedPage, plan: Extract<PagePlan, { kind: "sections" }>): void {
    const { app } = this;
    const settings = this.services.store.settings;
    const collapsed = new Set(this.collapsedIds());
    for (const planned of plan.sections) {
      const { config, cards, more } = planned.section;
      const from = plan.templateOf(config.id);
      const moves: SectionMove[] = planned.moves.map((move) => ({
        title: move.title,
        change: move.change,
        run: (file) => void this.applyChange(file, move.template, from),
      }));
      const { create, drop } = planned;
      const el = renderSection(parent, planned.title, cards, settings, this.actions, {
        style: { kind: config.kind, classes: cssClassList(config.cssClass) },
        menuContext: { sectionKind: config.kind, moves },
        create: create ? { tooltip: create.tooltip, run: (evt) => void createNote(app, paneFor(evt), create.template) } : undefined,
        dragId: planned.draggable ? config.id : undefined,
        drop: drop
          ? {
              hint: drop.hint,
              run: (path, fromSection) => {
                const file = app.vault.getFileByPath(path);
                if (file) void this.applyChange(file, drop.template, plan.templateOf(fromSection));
              },
            }
          : undefined,
        emptyText: planned.emptyText,
        more,
        fold: {
          collapsed: collapsed.has(this.foldKey(config.id, page)),
          onToggle: (now) => this.rememberCollapsed(this.foldKey(config.id, page), now),
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

  /** Make a section's stated change to a note, through Obsidian, and say what changed. */
  private async applyChange(file: TFile, template: NoteTemplate, from?: NoteTemplate): Promise<void> {
    try {
      const done = await applyTemplate(this.app, file, template, from);
      new Notice(done ? `${done} on ${file.basename}.` : `${file.basename} already has these values.`);
    } catch (err) {
      console.error("Home Cards: could not change the note", err);
      new Notice(`Could not change ${file.basename}. See the console for details.`);
    }
  }

  // ------------------------------------------------------- section state

  /**
   * The key a section's folded state is stored under. Every other page
   * keys on its own identity as well, so folding "Recently modified" on
   * one page does not fold it on the rest; the home page keeps its
   * original keys.
   */
  private foldKey(sectionId: string, page: ResolvedPage): string {
    return page.isHome ? sectionId : `${sectionId}@${page.key}`;
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

/** What a page's dateline says about its scope; empty when it has none to say. */
function datelineScope(page: ResolvedPage): string {
  const { scope } = page;
  if (page.note) return page.note.split("/").slice(0, -1).join(" / ");
  switch (scope.kind) {
    case "folder":
      // The folders above this one place it; its own name is the title.
      return scope.folder.split("/").slice(0, -1).join(" / ");
    case "all":
      return "";
    default:
      return scopeSummary(scope).replace(/^[^:]+: /, "");
  }
}
