/**
 * Plugin lifecycle and nothing else: load settings, register views and
 * commands, persist edits, and tell open views to redraw.
 *
 * Layers, each importing only from those above it (a type-only import of
 * this class, for the plugin handle, is the one exception):
 *
 *   settings/      schema, defaults, and the normalizer for stored data
 *   compose/       vault queries and card models; no DOM
 *   render/        the Home view and the Bases view
 *   settings-tab/  the settings UI
 *   main.ts        wiring
 */

import { debounce, Events, Notice, Plugin, TFile, TFolder, type EventRef, type ObsidianProtocolData } from "obsidian";
import { forgetMarks, isPinned, isQuiet, pruneSnoozes, renameMarks, snooze, togglePin, toggleQuiet } from "./compose/marks";
import type { MarkActions } from "./render/actions";
import { ActivityLog } from "./compose/activity";
import { DekCache } from "./compose/dek-cache";
import { OpenHistory } from "./compose/open-history";
import { BASES_VIEW_ID, registerBasesView } from "./render/bases-view";
import { pickFolder } from "./render/folder-picker";
import { HomeView, VIEW_TYPE_HOME } from "./render/home-view";
import { pickPage } from "./render/page-picker";
import { normalizeFolderPath } from "./settings/folders";
import { normalizeSettings } from "./settings/normalize";
import {
  findPageByName,
  refFromState,
  renamePageFolders,
  resolvePage,
  stateFromRef,
  suggestPageName,
  uniquePageName,
  type PageRef,
} from "./settings/pages";
import { blankScope, defaultSettings, LIMITS, newPageId, type HomeCardsSettings, type NamedPage } from "./settings/schema";
import { checkForUpdate, compareVersions, laterVersion, recentNotes, type ReleaseNote } from "./settings/release-notes";
import { WhatsNewModal } from "./render/whats-new";
import { asRelateApi, RELATE_EVENTS, type RelateApi, type SearchOptions } from "./compose/relate";
import { PageModal } from "./settings-tab/page-modal";
import { HomeCardsSettingTab } from "./settings-tab/tab";

const REFRESH = "refresh";
/** The list of named pages, or one page's name, changed. */
const PAGES = "pages";
/** Quiet period after the last keystroke before an edit is written. */
const SAVE_DELAY_MS = 400;
/** Quiet period after the last open before the activity log is written. */
const ACTIVITY_SAVE_MS = 5000;
/** Quiet period after the metadata cache settles before views recompose. */
const RESOLVE_DELAY_MS = 1500;
/** Local-storage key for this device's copy of the release marker; see release-notes.ts. */
const RELEASE_KEY = "home-cards-release-seen";

export default class HomeCardsPlugin extends Plugin {
  settings: HomeCardsSettings = defaultSettings();

  /** Shared by every view. Bounded, and self-invalidating on mtime and settings. */
  readonly dekCache = new DekCache();

  /** Opened notes beyond the ten Obsidian remembers, for "Recently opened". */
  readonly openHistory = new OpenHistory(this.app);

  /** Timed opens and visits, for Continue working, Related and Old friends. */
  readonly activity = new ActivityLog(this.app);
  private readonly saveActivity = debounce(() => this.activity.flush(), ACTIVITY_SAVE_MS, true);

  /**
   * Views subscribe here to redraw after a settings change or a metadata
   * update. The plugin holds no view references; each view's Component
   * releases its subscription when the view closes.
   */
  private readonly events = new Events();

  /** True while an edit sits in memory that data.json does not have. */
  private dirty = false;
  private readonly flushSoon = debounce(() => void this.flush(), SAVE_DELAY_MS, true);

  /**
   * Pins, snoozes and quiet notes, as cards and menus change them. Each
   * change writes at once and redraws every page.
   */
  readonly markActions: MarkActions = {
    isPinned: (path) => isPinned(this.settings.marks, path),
    togglePin: (path) => this.mark(togglePin(this.settings.marks, path)),
    snooze: (path, days) => this.mark(snooze(this.settings.marks, path, new Date(), days)),
    isQuiet: (path) => isQuiet(this.settings.marks, path),
    toggleQuiet: (path) => this.mark(toggleQuiet(this.settings.marks, path)),
  };

  private mark(changed: boolean): void {
    if (changed) void this.commit();
  }

  /**
   * Releases the home page announces, newest first; empty once the reader
   * has read or dismissed them, or when there is nothing new.
   */
  releaseNotes: ReleaseNote[] = [];

  /**
   * Relate's API while the Relate plugin runs, else null. Relate hands it
   * over through workspace events; see connectRelate.
   */
  relate: RelateApi | null = null;

  /**
   * Relate searches kept between redraws, so every open page shares one
   * search per query until the vault or Relate changes. A search that
   * misses the page's wait redraws the pages when it arrives.
   */
  readonly relateSearches: SearchOptions = {
    cache: new Map(),
    onLate: () => this.refreshViews(),
    sleep: (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
  };

  /**
   * One redraw per burst of changes, whether the metadata cache or Relate
   * reports them: one edit to a relationship fires both.
   */
  private readonly settle = debounce(
    () => {
      this.relateSearches.cache?.clear();
      this.refreshViews();
    },
    RESOLVE_DELAY_MS,
    true
  );

  /** Named pages that have a command, with the name each was registered under. */
  private readonly pageCommands = new Map<string, string>();

  async onload(): Promise<void> {
    const firstRun = !(await this.loadSettings());
    this.reviewRelease(firstRun);

    this.registerView(VIEW_TYPE_HOME, (leaf) => new HomeView(leaf, this));
    // Lets Page Preview show notes on hover over cards; it lists this
    // source in its settings, defaulting to Cmd or Ctrl held.
    this.registerHoverLinkSource(VIEW_TYPE_HOME, { display: "Home Cards", defaultMod: true });
    registerBasesView(this);
    this.addSettingTab(new HomeCardsSettingTab(this));

    this.addRibbonIcon("layout-grid", "Open home page", () => void this.activateView());
    this.addCommand({ id: "open", name: "Open", callback: () => void this.activateView() });
    this.addCommand({ id: "recompose", name: "Recompose", callback: () => this.refreshViews() });
    this.addCommand({ id: "whats-new", name: "Show what's new", callback: () => this.showWhatsNew() });

    // Pages. A page opens from a command, a list, a folder's context menu
    // or a link, so any file browser can reach it. Each named page also
    // gets a command of its own (see syncPageCommands), which takes a hotkey.
    this.addCommand({ id: "open-page", name: "Open a page", callback: () => pickPage(this) });
    this.addCommand({ id: "create-page", name: "Create a page", callback: () => this.createPage({ open: true }) });
    this.addCommand({
      id: "open-current-folder",
      name: "Open page for current folder",
      checkCallback: (checking) => {
        const folder = this.app.workspace.getActiveFile()?.parent;
        if (!folder || folder.isRoot()) return false;
        if (!checking) void this.activateView({ folder: folder.path });
        return true;
      },
    });
    this.addCommand({
      id: "open-folder",
      name: "Open page for a folder",
      callback: () => pickFolder(this.app, (folder) => void this.activateView({ folder: folder.path })),
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        const ref: PageRef | null =
          file instanceof TFolder && !file.isRoot()
            ? { folder: file.path }
            : file instanceof TFile && file.extension === "md"
              ? { note: file.path }
              : null;
        if (!ref) return;
        menu.addItem((item) =>
          item
            .setSection("action")
            .setTitle("Open Home Cards page")
            .setIcon("layout-grid")
            .onClick(() => void this.activateView(ref))
        );
      })
    );
    // obsidian://home-cards?page=Name or ?folder=Path, from a note, a
    // Shortcut or a launcher. The parameters are untrusted text: they pick
    // among existing pages and folders and nothing else.
    this.registerObsidianProtocolHandler("home-cards", (params) => void this.openFromLink(params));
    this.syncPageCommands();

    // A note's page: what the note links to, what links to it and, with
    // Relate, its relationships.
    this.addCommand({
      id: "open-current-note",
      name: "Open page for current note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.activateView({ note: file.path });
        return true;
      },
    });
    this.connectRelate();

    // "resolved" fires after every batch of metadata changes; one redraw
    // per burst is plenty.
    this.registerEvent(this.app.metadataCache.on("resolved", () => this.settle()));

    // Keep the open history as notes open and move.
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file?.extension !== "md") return;
        this.openHistory.record(file.path);
        this.activity.record(file.path);
        this.saveActivity();
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.openHistory.rename(oldPath, file.path);
        this.activity.rename(oldPath, file.path);
        this.saveActivity();
        // A page about a folder follows it when it is renamed, and marks
        // follow their notes, singly or with their folder.
        const pages = file instanceof TFolder && renamePageFolders(this.settings.pages, oldPath, file.path);
        const marks = renameMarks(this.settings.marks, oldPath, file.path);
        if (pages || marks) this.touch();
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (forgetMarks(this.settings.marks, file.path)) this.touch();
        this.activity.forget(file.path);
        this.saveActivity();
      })
    );

    // Pinning from Obsidian's own file menus and the command palette.
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file, source) => {
        // A card's own menu already offers its marks; see render/actions.ts.
        if (source === VIEW_TYPE_HOME || source === BASES_VIEW_ID) return;
        if (!(file instanceof TFile) || file.extension !== "md") return;
        const pinned = isPinned(this.settings.marks, file.path);
        menu.addItem((item) =>
          item
            .setSection("action")
            .setTitle(pinned ? "Unpin from Home" : "Pin to Home")
            .setIcon(pinned ? "pin-off" : "pin")
            .onClick(() => this.markActions.togglePin(file.path))
        );
      })
    );
    this.addCommand({
      id: "toggle-pin",
      name: "Pin or unpin the current note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) this.markActions.togglePin(file.path);
        return true;
      },
    });

    if (this.settings.openOnStartup) {
      this.app.workspace.onLayoutReady(() => void this.activateView());
    }
  }

  /**
   * data.json changed on disk, from a sync service or another device.
   * Without an edit pending here, the stored settings win; with one, the
   * next save writes this device's edit over them, as it would anyway.
   */
  async onExternalSettingsChange(): Promise<void> {
    if (this.dirty) return;
    await this.loadSettings();
    // Another device read or dismissed the notice.
    if (this.releaseNotes.length && compareVersions(this.seenVersion(), this.manifest.version) >= 0) {
      this.releaseNotes = [];
    }
    if (this.syncPageCommands()) this.events.trigger(PAGES);
    this.refreshViews();
  }

  onunload(): void {
    this.settle.cancel();
    // Views are closing; write the pending edit without redrawing them.
    void this.write();
    this.saveActivity.cancel();
    this.activity.flush();
  }

  // ------------------------------------------------------------ persistence

  /** Record an edit; write once the edits stop. For keystrokes and sliders. */
  touch(): void {
    this.dirty = true;
    this.flushSoon();
  }

  /** Record an edit and write it now. For structural changes. */
  async commit(): Promise<void> {
    this.dirty = true;
    await this.flush();
  }

  /** Write a pending edit, if any, and redraw the views that show it. */
  async flush(): Promise<void> {
    const wrote = await this.write();
    if (this.syncPageCommands()) this.events.trigger(PAGES);
    if (wrote) this.refreshViews();
  }

  /** Write a pending edit. Resolves true when there was one. */
  private async write(): Promise<boolean> {
    this.flushSoon.cancel();
    if (!this.dirty) return false;
    this.dirty = false;
    try {
      await this.saveData(this.settings);
    } catch (err) {
      // Keep the edit pending, so the next touch, commit or close retries.
      this.dirty = true;
      console.error("Home Cards: could not save settings", err);
    }
    return true;
  }

  /** Read data.json. Resolves false when there was none: a new install. */
  private async loadSettings(): Promise<boolean> {
    let stored: unknown = null;
    try {
      stored = await this.loadData();
    } catch (err) {
      console.error("Home Cards: settings unreadable, using defaults", err);
    }
    this.settings = normalizeSettings(stored);
    // Ended snoozes need no record; drop them with the next save.
    if (pruneSnoozes(this.settings.marks, new Date())) this.dirty = true;
    return stored !== null && stored !== undefined;
  }

  // -------------------------------------------------------------- releases

  /** The newest release seen here: the later of the synced and the local marker. */
  private seenVersion(): string {
    const local: unknown = this.app.loadLocalStorage(RELEASE_KEY);
    return laterVersion(this.settings.lastShownVersion, typeof local === "string" ? local : "");
  }

  /** At load: queue the notice for unseen releases, or mark this version seen. */
  private reviewRelease(firstRun: boolean): void {
    const decision = checkForUpdate({
      current: this.manifest.version,
      seen: this.seenVersion(),
      firstRun,
      enabled: this.settings.showReleaseNotes,
    });
    if (decision.kind === "announce") this.releaseNotes = decision.notes;
    else if (decision.kind === "record") this.markReleaseSeen();
  }

  /**
   * Mark the installed version seen, here and in synced settings, never
   * moving a marker back. Returns true when it saves, which redraws the views.
   */
  private markReleaseSeen(): boolean {
    const current = this.manifest.version;
    const local: unknown = this.app.loadLocalStorage(RELEASE_KEY);
    this.app.saveLocalStorage(RELEASE_KEY, laterVersion(typeof local === "string" ? local : "", current));
    const synced = laterVersion(this.settings.lastShownVersion, current);
    if (synced === this.settings.lastShownVersion) return false;
    this.settings.lastShownVersion = synced;
    void this.commit();
    return true;
  }

  /** Close the home page's notice without reading the notes. */
  dismissReleaseNotes(): void {
    if (!this.releaseNotes.length) return;
    this.releaseNotes = [];
    if (!this.markReleaseSeen()) this.refreshViews();
  }

  /**
   * Open the release notes: the unseen ones when the home page announces
   * them, and closing the window marks them read; otherwise the latest.
   */
  showWhatsNew(): void {
    const unseen = this.releaseNotes.length > 0;
    const notes = unseen ? this.releaseNotes : recentNotes(this.manifest.version);
    new WhatsNewModal(this.app, notes, unseen ? () => this.dismissReleaseNotes() : undefined).open();
  }

  // ------------------------------------------------------------------ views

  /**
   * Reveal a page, opening it in a new tab if it is not open. Every page
   * has at most one tab, however it was reached: a folder with a named
   * page opens that page.
   */
  async activateView(ref: PageRef = {}): Promise<void> {
    const { workspace } = this.app;
    const target = resolvePage(this.settings, ref);
    if (!target) {
      new Notice("Home Cards: that page no longer exists.");
      return;
    }
    // The saved view state names the page even for a tab that Obsidian
    // has not loaded yet, so this never wakes a deferred view.
    const existing = workspace.getLeavesOfType(VIEW_TYPE_HOME).find((leaf) => {
      const open = resolvePage(this.settings, refFromState(leaf.getViewState().state));
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

  // ------------------------------------------------------------------ pages

  /** Open a page from an `obsidian://home-cards` link. */
  private async openFromLink(params: ObsidianProtocolData): Promise<void> {
    const shown = (text: string) => (text.length > 60 ? `${text.slice(0, 60)}…` : text);
    if (params.page) {
      const page = findPageByName(this.settings.pages, params.page);
      if (page) await this.activateView({ page: page.id });
      else new Notice(`Home Cards: no page named "${shown(params.page)}".`);
    } else if (params.note) {
      const note = this.app.metadataCache.getFirstLinkpathDest(params.note, "");
      if (note?.extension === "md") await this.activateView({ note: note.path });
      else new Notice(`Home Cards: no note named "${shown(params.note)}".`);
    } else if (params.folder) {
      const folder = normalizeFolderPath(params.folder);
      if (folder && this.app.vault.getFolderByPath(folder)) await this.activateView({ folder });
      else new Notice(`Home Cards: no folder named "${shown(params.folder)}".`);
    } else {
      await this.activateView();
    }
  }

  /**
   * Keep one command per named page, named for the page. A renamed page
   * gets its command replaced under the same id, so its hotkey stays.
   * Called after every save and once at load. Returns whether any command
   * was added, renamed or removed.
   */
  private syncPageCommands(): boolean {
    let changed = false;
    const wanted = new Map(this.settings.pages.map((page) => [page.id, page.name]));
    for (const [id, name] of this.pageCommands) {
      if (wanted.get(id) === name) continue;
      this.removeCommand(`open-${id}`);
      this.pageCommands.delete(id);
      changed = true;
    }
    for (const [id, name] of wanted) {
      if (this.pageCommands.has(id)) continue;
      this.addCommand({ id: `open-${id}`, name: `Open ${name} page`, callback: () => void this.activateView({ page: id }) });
      this.pageCommands.set(id, name);
      changed = true;
    }
    return changed;
  }

  /**
   * Open the editor for a new page. Nothing is saved until the editor's
   * Create button; `open` also opens the page in a tab once it exists.
   */
  createPage({ open, onCreated }: { open: boolean; onCreated?: (page: NamedPage) => void }): void {
    if (this.settings.pages.length >= LIMITS.pages.max) {
      new Notice(`Home Cards: a vault can have up to ${LIMITS.pages.max} pages.`);
      return;
    }
    const draft: NamedPage = { id: newPageId(), name: "", scope: blankScope(), sections: null };
    new PageModal(this, draft, "create", (page) => {
      void this.commit().then(async () => {
        onCreated?.(page);
        if (open) await this.activateView({ page: page.id });
      });
    }).open();
  }

  /**
   * Open the editor for a page. A folder page that has no record is saved
   * as a named page for the editor to change; if the editor closes with it
   * untouched, the record is dropped again and the folder follows the home
   * page as before.
   */
  editPage(ref: PageRef): void {
    const resolved = resolvePage(this.settings, ref);
    if (!resolved || resolved.isHome) return;
    let page = resolved.record;
    let untouched: string | null = null;
    if (!page) {
      if (this.settings.pages.length >= LIMITS.pages.max) {
        new Notice(`Home Cards: a vault can have up to ${LIMITS.pages.max} pages.`);
        return;
      }
      page = {
        id: newPageId(),
        name: uniquePageName(this.settings.pages, suggestPageName(resolved.scope)),
        scope: { ...resolved.scope },
        sections: null,
      };
      this.settings.pages.push(page);
      untouched = JSON.stringify(page);
    }
    const saved = page;
    new PageModal(this, saved, "edit", () => {
      if (untouched !== null && JSON.stringify(saved) === untouched) {
        const pages = this.settings.pages;
        pages.splice(pages.indexOf(saved), 1);
        this.touch();
      }
      void this.flush();
    }).open();
  }

  // ------------------------------------------------------------------ Relate

  /**
   * Listen for the Relate plugin, which is optional. Relate announces its
   * API with a public workspace event when it is ready and answers a
   * request from a plugin that loaded after it, so either load order works.
   * Home Cards never reads Relate's plugin instance or files, and a Relate
   * whose contract it does not know counts as absent.
   */
  private connectRelate(): void {
    const bus: Events = this.app.workspace;
    const use = (api: RelateApi | null) => {
      if (api === this.relate) return;
      this.relate = api;
      this.relateSearches.cache?.clear();
      this.refreshViews();
    };
    this.registerEvent(bus.on(RELATE_EVENTS.ready, (api: unknown) => use(asRelateApi(api))));
    this.registerEvent(bus.on(RELATE_EVENTS.unload, () => use(null)));
    this.registerEvent(
      bus.on(RELATE_EVENTS.changed, () => {
        if (this.relate) this.settle();
      })
    );
    bus.trigger(RELATE_EVENTS.request);
  }

  /** Subscribe to changes in the list of pages; pass the result to `registerEvent`. */
  onPagesChanged(callback: () => void): EventRef {
    return this.events.on(PAGES, callback);
  }

  /** Subscribe to redraw requests; pass the result to `registerEvent`. */
  onRefresh(callback: () => void): EventRef {
    return this.events.on(REFRESH, callback);
  }

  /** Ask every open Home and Bases view to redraw. */
  refreshViews(): void {
    this.events.trigger(REFRESH);
  }
}
