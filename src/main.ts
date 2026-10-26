/**
 * The composition root: builds the plugin's services, hands each view and
 * editor the narrow part it needs, and registers views, commands, menus
 * and event listeners with Obsidian. Rules live in the layers below.
 *
 * Layers, each importing only from those above it:
 *
 *   settings/      schema, defaults, the normalizer and the settings store
 *   compose/       the domain: vault queries, ranking, card models, page plans; no DOM
 *   render/        the Home view and the Bases view
 *   settings-tab/  the settings UI and the page service
 *   main.ts        wiring
 */

import { debounce, Events, Notice, Plugin, TFile, TFolder, type ObsidianProtocolData } from "obsidian";
import { ActivityLog } from "./compose/activity";
import { DekCache } from "./compose/dek-cache";
import { forgetMarks, isPinned, isQuiet, pruneSnoozes, renameMarks, snooze, togglePin, toggleQuiet } from "./compose/marks";
import { OpenHistory } from "./compose/open-history";
import { asPagewiseApi, notePageButton, PAGEWISE_EVENTS } from "./compose/pagewise";
import { connectPartner } from "./compose/partner";
import { asRelateApi, RELATE_EVENTS, type RelateApi, type RelateStatus, type SearchOptions } from "./compose/relate";
import type { MarkActions } from "./render/actions";
import { BackgroundStore } from "./render/backgrounds";
import { BASES_VIEW_ID, registerBasesView } from "./render/bases-view";
import { pickFolder } from "./render/folder-picker";
import { HomeView, VIEW_TYPE_HOME, type HomeServices } from "./render/home-view";
import { pickPage } from "./render/page-picker";
import { ReleaseNotices } from "./render/release-notices";
import { normalizeFolderPath } from "./settings/folders";
import { findPageByName, renamePageFolders, type PageRef } from "./settings/pages";
import { NEWER_SETTINGS_NOTICE, SettingsStore } from "./settings/store";
import { PageService } from "./settings-tab/page-service";
import type { EditorContext } from "./settings-tab/section-modal";
import { HomeCardsSettingTab } from "./settings-tab/tab";

const REFRESH = "refresh";
/** The list of named pages or a page's name changed, or settings arrived from another device. */
const PAGES = "pages";
/** Quiet period after the last keystroke before an edit is written. */
const SAVE_DELAY_MS = 400;
/** Quiet period after the last open before the activity log is written. */
const ACTIVITY_SAVE_MS = 5000;
/** Quiet period after the metadata cache settles before views recompose. */
const RESOLVE_DELAY_MS = 1500;

export default class HomeCardsPlugin extends Plugin {
  /** The settings in memory and on disk; see settings/store.ts. */
  private readonly store = new SettingsStore({
    storage: { load: () => this.loadData(), save: (settings) => this.saveData(settings) },
    debounce: (run) => debounce(run, SAVE_DELAY_MS, true),
    // Ended snoozes need no record; the next save drops them.
    tidy: (settings) => void pruneSnoozes(settings.marks, new Date()),
    afterWrite: (wrote) => {
      if (this.syncPageCommands()) this.events.trigger(PAGES);
      if (wrote) this.refreshViews();
    },
    afterReload: () => this.settingsReloaded(),
    onNewer: () => new Notice(NEWER_SETTINGS_NOTICE, 0),
    onError: (message, err) => console.error(message, err),
  });

  /** Shared by every view. Bounded, and self-invalidating on mtime and settings. */
  private readonly dekCache = new DekCache();

  /** Opened notes beyond the ten Obsidian remembers, for "Recently opened". */
  private readonly openHistory = new OpenHistory(this.app);

  /** Timed opens and visits, for Continue working, Related and Old friends. */
  private readonly activity = new ActivityLog(this.app);
  private readonly saveActivity = debounce(() => this.activity.flush(), ACTIVITY_SAVE_MS, true);

  /**
   * Views subscribe here to redraw after a settings change or a metadata
   * update. The plugin holds no view references; each view's Component
   * releases its subscription when the view closes.
   */
  private readonly events = new Events();

  /**
   * Pins, snoozes and quiet notes, as cards and menus change them. Each
   * change writes at once and redraws every page.
   */
  private readonly marks: MarkActions = {
    isPinned: (path) => isPinned(this.store.settings.marks, path),
    togglePin: (path) => this.mark(togglePin(this.store.settings.marks, path)),
    snooze: (path, days) => this.mark(snooze(this.store.settings.marks, path, new Date(), days)),
    isQuiet: (path) => isQuiet(this.store.settings.marks, path),
    toggleQuiet: (path) => this.mark(toggleQuiet(this.store.settings.marks, path)),
  };

  private mark(changed: boolean): void {
    if (changed) void this.store.commit();
  }

  /**
   * Relate as Home Cards knows it now: its API while it runs and Home
   * Cards can use it, its status, and the searches every open page shares
   * until the vault or Relate changes. A search that misses the page's
   * wait redraws the pages when it arrives. See connectRelate.
   */
  private readonly relate: { api: RelateApi | null; status: RelateStatus; searches: SearchOptions } = {
    api: null,
    status: "absent",
    searches: {
      cache: new Map(),
      onLate: () => this.refreshViews(),
      sleep: (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
    },
  };

  /** What the section and page editors use. */
  private readonly editor: EditorContext = {
    app: this.app,
    store: this.store,
    relateStatus: () => this.relate.status,
  };

  private readonly pages = new PageService(this.editor);
  private readonly releases = new ReleaseNotices(this.app, this.store, this.manifest.version, () => this.refreshViews());
  private readonly backgrounds = BackgroundStore.forPlugin(this.app, this.manifest);

  /** What the home and Bases views use. */
  private readonly services: HomeServices = {
    store: this.store,
    pages: this.pages,
    marks: this.marks,
    backgrounds: this.backgrounds,
    dekCache: this.dekCache,
    openHistory: this.openHistory,
    activity: this.activity,
    relate: this.relate,
    releases: this.releases,
    onRefresh: (callback) => this.events.on(REFRESH, callback),
  };

  /**
   * One redraw per burst of changes, whether the metadata cache or Relate
   * reports them: one edit to a relationship fires both.
   */
  private readonly settle = debounce(
    () => {
      this.relate.searches.cache?.clear();
      this.refreshViews();
    },
    RESOLVE_DELAY_MS,
    true
  );

  /** Named pages that have a command, with the name each was registered under. */
  private readonly pageCommands = new Map<string, string>();

  async onload(): Promise<void> {
    const firstRun = !(await this.store.load());
    this.releases.review(firstRun);

    this.registerView(VIEW_TYPE_HOME, (leaf) => new HomeView(leaf, this.services));
    // Lets Page Preview show notes on hover over cards; it lists this
    // source in its settings, defaulting to Cmd or Ctrl held.
    this.registerHoverLinkSource(VIEW_TYPE_HOME, { display: "Home Cards", defaultMod: true });
    registerBasesView(this, this.services);
    this.addSettingTab(
      new HomeCardsSettingTab(this, {
        editor: this.editor,
        pages: this.pages,
        backgrounds: this.backgrounds,
        showWhatsNew: () => this.releases.show(),
        version: this.manifest.version,
        onPagesChanged: (callback) => this.events.on(PAGES, callback),
      })
    );

    this.addRibbonIcon("layout-grid", "Open home page", () => void this.pages.open());
    this.addCommand({ id: "open", name: "Open", callback: () => void this.pages.open() });
    this.addCommand({ id: "recompose", name: "Recompose", callback: () => this.refreshViews() });
    this.addCommand({ id: "whats-new", name: "Show what's new", callback: () => this.releases.show() });

    // Pages. A page opens from a command, a list, a folder's context menu
    // or a link, so any file browser can reach it. Each named page also
    // gets a command of its own (see syncPageCommands), which takes a hotkey.
    this.addCommand({ id: "open-page", name: "Open a page", callback: () => pickPage(this.app, this.store, this.pages) });
    this.addCommand({ id: "create-page", name: "Create a page", callback: () => this.pages.create({ open: true }) });
    this.addCommand({
      id: "open-current-folder",
      name: "Open page for current folder",
      checkCallback: (checking) => {
        const folder = this.app.workspace.getActiveFile()?.parent;
        if (!folder || folder.isRoot()) return false;
        if (!checking) void this.pages.open({ folder: folder.path });
        return true;
      },
    });
    this.addCommand({
      id: "open-folder",
      name: "Open page for a folder",
      callback: () => pickFolder(this.app, (folder) => void this.pages.open({ folder: folder.path })),
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
            .onClick(() => void this.pages.open(ref))
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
        if (!checking) void this.pages.open({ note: file.path });
        return true;
      },
    });
    this.connectRelate();
    this.connectPagewise();

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
        const pages = file instanceof TFolder && renamePageFolders(this.store.settings.pages, oldPath, file.path);
        const marks = renameMarks(this.store.settings.marks, oldPath, file.path);
        if (pages || marks) this.store.touch();
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (forgetMarks(this.store.settings.marks, file.path)) this.store.touch();
        this.openHistory.forget(file.path);
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
        const pinned = isPinned(this.store.settings.marks, file.path);
        menu.addItem((item) =>
          item
            .setSection("action")
            .setTitle(pinned ? "Unpin from Home" : "Pin to Home")
            .setIcon(pinned ? "pin-off" : "pin")
            .onClick(() => this.marks.togglePin(file.path))
        );
      })
    );
    this.addCommand({
      id: "toggle-pin",
      name: "Pin or unpin the current note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) this.marks.togglePin(file.path);
        return true;
      },
    });

    if (this.store.settings.openOnStartup) {
      this.app.workspace.onLayoutReady(() => void this.pages.open());
    }
  }

  /**
   * data.json changed on disk, from a sync service or another device.
   * Without an edit pending here, the stored settings win; with one, the
   * next save writes this device's edit over them, as it would anyway.
   */
  async onExternalSettingsChange(): Promise<void> {
    await this.store.reload();
  }

  /** Settings from another device replaced the ones in memory. */
  private settingsReloaded(): void {
    this.releases.reconcile();
    this.syncPageCommands();
    // The settings tab, if open, redraws from the new objects.
    this.events.trigger(PAGES);
    this.refreshViews();
  }

  onunload(): void {
    this.settle.cancel();
    // Views are closing; write the pending edit without redrawing them.
    void this.store.write();
    this.saveActivity.cancel();
    this.activity.flush();
  }

  // ------------------------------------------------------------------ pages

  /** Open a page from an `obsidian://home-cards` link. */
  private async openFromLink(params: ObsidianProtocolData): Promise<void> {
    const shown = (text: string) => (text.length > 60 ? `${text.slice(0, 60)}…` : text);
    if (params.page) {
      const page = findPageByName(this.store.settings.pages, params.page);
      if (page) await this.pages.open({ page: page.id });
      else new Notice(`Home Cards: no page named "${shown(params.page)}".`);
    } else if (params.note) {
      const note = this.app.metadataCache.getFirstLinkpathDest(params.note, "");
      if (note?.extension === "md") await this.pages.open({ note: note.path });
      else new Notice(`Home Cards: no note named "${shown(params.note)}".`);
    } else if (params.folder) {
      const folder = normalizeFolderPath(params.folder);
      if (folder && this.app.vault.getFolderByPath(folder)) await this.pages.open({ folder });
      else new Notice(`Home Cards: no folder named "${shown(params.folder)}".`);
    } else {
      await this.pages.open();
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
    const wanted = new Map(this.store.settings.pages.map((page) => [page.id, page.name]));
    for (const [id, name] of this.pageCommands) {
      if (wanted.get(id) === name) continue;
      this.removeCommand(`open-${id}`);
      this.pageCommands.delete(id);
      changed = true;
    }
    for (const [id, name] of wanted) {
      if (this.pageCommands.has(id)) continue;
      this.addCommand({ id: `open-${id}`, name: `Open ${name} page`, callback: () => void this.pages.open({ page: id }) });
      this.pageCommands.set(id, name);
      changed = true;
    }
    return changed;
  }

  // ------------------------------------------------------------------ Relate

  /**
   * Listen for the Relate plugin, which is optional, through the public
   * handshake in compose/partner.ts. Home Cards never reads Relate's plugin
   * instance or files. A Relate whose contract Home Cards does not know is
   * present but incompatible, and the sections that need it say so.
   */
  private connectRelate(): void {
    connectPartner(this.app.workspace, {
      name: "Relate",
      events: RELATE_EVENTS,
      accept: asRelateApi,
      register: (ref) => this.registerEvent(ref),
      warn: (message) => console.warn(message),
      onState: (state) => {
        this.relate.api = state.kind === "present" ? state.api : null;
        this.relate.status = state.kind;
        this.relate.searches.cache?.clear();
        this.refreshViews();
      },
      onChanged: () => this.settle(),
    });
  }

  // ---------------------------------------------------------------- Pagewise

  /**
   * Offer a toolbar button to the Pagewise plugin, which is optional,
   * through the public handshake in compose/partner.ts. Home Cards never
   * reads Pagewise's plugin instance. The button goes when Pagewise
   * unloads, when it announces a contract Home Cards does not know, and
   * when Home Cards itself unloads.
   */
  private connectPagewise(): void {
    let remove: (() => void) | null = null;
    const detach = () => {
      try {
        remove?.();
      } catch {
        // A failing Pagewise only loses the button.
      }
      remove = null;
    };
    this.register(detach);
    connectPartner(this.app.workspace, {
      name: "Pagewise",
      events: PAGEWISE_EVENTS,
      accept: asPagewiseApi,
      register: (ref) => this.registerEvent(ref),
      warn: (message) => console.warn(message),
      onState: (state) => {
        detach();
        if (state.kind !== "present") return;
        try {
          remove = state.api.registerToolbarItem(notePageButton((path) => void this.pages.open({ note: path })));
        } catch {
          remove = null;
        }
      },
    });
  }

  /** Ask every open Home and Bases view to redraw. */
  private refreshViews(): void {
    this.events.trigger(REFRESH);
  }
}
