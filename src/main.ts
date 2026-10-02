/**
 * Plugin lifecycle and nothing else: load settings, register views and
 * commands, persist edits, and tell open views to redraw.
 *
 * Layers, each importing only from those above it (a type-only import of
 * this class, for the plugin handle, is the one exception):
 *
 *   settings/      schema, defaults, and the normalizer for stored data
 *   compose/       vault queries and card models; no DOM
 *   platform/      macOS integration (Shortcuts, for Apple Intelligence)
 *   render/        the Home view and the Bases view
 *   settings-tab/  the settings UI
 *   main.ts        wiring
 */

import { debounce, Events, Plugin, type EventRef } from "obsidian";
import { DekCache } from "./compose/dek-cache";
import { OpenHistory } from "./compose/open-history";
import { GreetingSource } from "./platform/greeting-source";
import { runShortcut, shortcutsSupported } from "./platform/shortcuts";
import { registerBasesView } from "./render/bases-view";
import { HomeView, VIEW_TYPE_HOME } from "./render/home-view";
import { normalizeSettings } from "./settings/normalize";
import { defaultSettings, type HomeCardsSettings } from "./settings/schema";
import { HomeCardsSettingTab } from "./settings-tab/tab";

const REFRESH = "refresh";
/** Quiet period after the last keystroke before an edit is written. */
const SAVE_DELAY_MS = 400;
/** Quiet period after the metadata cache settles before views recompose. */
const RESOLVE_DELAY_MS = 1500;

export default class HomeCardsPlugin extends Plugin {
  settings: HomeCardsSettings = defaultSettings();

  /** Shared by every view. Bounded, and self-invalidating on mtime and settings. */
  readonly dekCache = new DekCache();

  /** Opened notes beyond the ten Obsidian remembers, for "Recently opened". */
  readonly openHistory = new OpenHistory(this.app);

  /** The masthead greeting: the built-in list, or Apple Intelligence. */
  readonly greetings = new GreetingSource(this.app, () => this.settings, {
    supported: shortcutsSupported,
    run: (shortcut, prompt) => runShortcut(shortcut, prompt),
  });

  /**
   * Views subscribe here to redraw after a settings change or a metadata
   * update. The plugin holds no view references; each view's Component
   * releases its subscription when the view closes.
   */
  private readonly events = new Events();

  /** True while an edit sits in memory that data.json does not have. */
  private dirty = false;
  private readonly flushSoon = debounce(() => void this.flush(), SAVE_DELAY_MS, true);

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_HOME, (leaf) => new HomeView(leaf, this));
    // Lets Page Preview show notes on hover over cards; it lists this
    // source in its settings, defaulting to Cmd or Ctrl held.
    this.registerHoverLinkSource(VIEW_TYPE_HOME, { display: "Home Cards", defaultMod: true });
    registerBasesView(this);
    this.addSettingTab(new HomeCardsSettingTab(this));

    this.addRibbonIcon("layout-grid", "Open home page", () => void this.activateView());
    this.addCommand({ id: "open", name: "Open", callback: () => void this.activateView() });
    this.addCommand({ id: "recompose", name: "Recompose", callback: () => this.refreshViews() });

    // "resolved" fires after every batch of metadata changes; one redraw
    // per burst is plenty.
    const settle = debounce(() => this.refreshViews(), RESOLVE_DELAY_MS, true);
    this.registerEvent(this.app.metadataCache.on("resolved", settle));

    // Keep the open history as notes open and move.
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file?.extension === "md") this.openHistory.record(file.path);
      })
    );
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.openHistory.rename(oldPath, file.path)));

    // Write the first greeting while the workspace settles.
    this.app.workspace.onLayoutReady(() => void this.greetings.refill(new Date()));

    if (this.settings.openOnStartup) {
      this.app.workspace.onLayoutReady(() => void this.activateView());
    }
  }

  onunload(): void {
    // Views are closing; write the pending edit without redrawing them.
    void this.write();
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
    if (await this.write()) this.refreshViews();
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

  private async loadSettings(): Promise<void> {
    let stored: unknown = null;
    try {
      stored = await this.loadData();
    } catch (err) {
      console.error("Home Cards: settings unreadable, using defaults", err);
    }
    this.settings = normalizeSettings(stored);
  }

  // ------------------------------------------------------------------ views

  /** Reveal the Home view, opening it in a new tab if none exists. */
  async activateView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_HOME)[0];
    if (existing) {
      await workspace.revealLeaf(existing);
      return;
    }
    const leaf = workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_HOME, active: true });
    await workspace.revealLeaf(leaf);
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
