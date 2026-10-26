/**
 * The settings in memory and on disk: when an edit is written, and when a
 * change that sync brings from another device replaces what is in memory.
 *
 * One rule decides between the two. An edit made on this device and not yet
 * written wins: the next save writes it over whatever arrived. With no edit
 * pending, the stored settings win and replace the ones in memory.
 * Housekeeping, such as dropping ended snoozes, changes memory without
 * counting as an edit, so it can never hold back a reload; the next real
 * save carries it. While an editor holds settings objects open, a reload
 * waits until it closes (see `hold`).
 *
 * Settings written by a newer Home Cards may hold keys this build does
 * not know, and the normalizer drops what it does not know. Saving them
 * back would erase the newer build's work on every synced device, so such
 * settings load read-only: edits apply in memory and are never written.
 *
 * Pure apart from the injected storage and timer, so the tests drive it
 * directly. main.ts builds the one instance.
 */

import { normalizeSettings } from "./normalize";
import { defaultSettings, SETTINGS_VERSION, type HomeCardsSettings } from "./schema";

/** What the plugin tells the reader when the stored settings come from a newer Home Cards. */
export const NEWER_SETTINGS_NOTICE =
  "Home Cards: your settings come from a newer version of Home Cards. Update Home Cards in Settings → Community plugins. Until then, changes made here are not saved.";

/** The `version` that stored settings carry, or 0 when they carry none. */
export function storedVersion(stored: unknown): number {
  if (typeof stored !== "object" || stored === null) return 0;
  const version = (stored as { version?: unknown }).version;
  return typeof version === "number" && Number.isFinite(version) ? version : 0;
}

/** Where the settings live: the plugin's data.json, through Obsidian. */
export interface SettingsStorage {
  load(): Promise<unknown>;
  save(settings: HomeCardsSettings): Promise<void>;
}

/** A call that runs once a burst of calls stops; Obsidian's `debounce` returns one. */
export interface Debounced {
  (): void;
  cancel(): void;
}

export interface SettingsStoreOptions {
  storage: SettingsStorage;
  /** Wraps the store's write so it runs once a burst of edits stops. */
  debounce: (run: () => void) => Debounced;
  /** Housekeeping after each load. It may change the settings; it is never saved on its own. */
  tidy?: (settings: HomeCardsSettings) => void;
  /** After every write attempt; `wrote` is false when nothing was pending. */
  afterWrite?: (wrote: boolean) => void;
  /** After settings from disk replaced the ones in memory because another device changed them. */
  afterReload?: () => void;
  /** When a load finds settings from a newer Home Cards, which then load read-only. */
  onNewer?: () => void;
  /** Reports a failure to read or write; the store carries on. */
  onError?: (message: string, err: unknown) => void;
}

/** The parts of the store that views and editors use. */
export interface SettingsAccess {
  /** The current settings. A reload replaces the object, so read it again after any await. */
  readonly settings: HomeCardsSettings;
  /** Record an edit; write once the edits stop. For keystrokes and sliders. */
  touch(): void;
  /** Record an edit and write it now. For structural changes. */
  commit(): Promise<void>;
  /** Write a pending edit, if any. */
  flush(): Promise<void>;
  /**
   * Keep the settings objects as they are while an editor changes them;
   * see SettingsStore.hold. Call the returned function when it closes.
   */
  hold(): () => void;
}

export class SettingsStore implements SettingsAccess {
  settings: HomeCardsSettings = defaultSettings();
  /** True while an edit sits in memory that data.json does not have. */
  private dirty = false;
  /** Writes under way; an edit being written counts as pending until it lands. */
  private saving = 0;
  private readonly writeSoon: Debounced;
  /** Editors open now that hold settings objects. */
  private holds = 0;
  /** A reload arrived while an editor was open. */
  private reloadWaiting = false;
  private newer = false;

  constructor(private readonly options: SettingsStoreOptions) {
    this.writeSoon = options.debounce(() => void this.flush());
  }

  /** Whether an edit is waiting to be written. */
  get pending(): boolean {
    return this.dirty;
  }

  /** True when the stored settings come from a newer Home Cards; nothing is written then. */
  get readOnly(): boolean {
    return this.newer;
  }

  /** Read data.json. Resolves false when there was none: a new install. */
  async load(): Promise<boolean> {
    let stored: unknown = null;
    try {
      stored = await this.options.storage.load();
    } catch (err) {
      this.options.onError?.("Home Cards: settings unreadable, using defaults", err);
    }
    const newer = storedVersion(stored) > SETTINGS_VERSION;
    if (newer && !this.newer) this.options.onNewer?.();
    this.newer = newer;
    this.settings = normalizeSettings(stored);
    this.options.tidy?.(this.settings);
    return stored !== null && stored !== undefined;
  }

  touch(): void {
    this.dirty = true;
    this.writeSoon();
  }

  async commit(): Promise<void> {
    this.dirty = true;
    await this.flush();
  }

  async flush(): Promise<void> {
    const wrote = await this.write();
    this.options.afterWrite?.(wrote);
  }

  /** Write a pending edit without telling anyone. Resolves true when there was one. */
  async write(): Promise<boolean> {
    this.writeSoon.cancel();
    if (!this.dirty) return false;
    this.dirty = false;
    // An edit to settings from a newer build stays in memory.
    if (this.newer) return true;
    this.saving++;
    try {
      await this.options.storage.save(this.settings);
    } catch (err) {
      // Keep the edit pending, so the next touch, commit or close retries.
      this.dirty = true;
      this.options.onError?.("Home Cards: could not save settings", err);
    } finally {
      this.saving--;
    }
    return true;
  }

  /**
   * data.json changed on disk, from a sync service or another device.
   * Resolves true when the stored settings replaced the ones in memory.
   */
  async reload(): Promise<boolean> {
    // An edit here, pending or being written, wins. Read-only settings
    // are never saved, so there an edit cannot win.
    if ((this.dirty || this.saving > 0) && !this.newer) return false;
    if (this.holds > 0) {
      this.reloadWaiting = true;
      return false;
    }
    await this.load();
    this.options.afterReload?.();
    return true;
  }

  /**
   * An editor that holds settings objects is opening. A reload replaces
   * every object, which would leave the editor changing one the settings
   * no longer contain, so a reload that arrives meanwhile waits until the
   * last editor closes. Then the usual rule applies: an edit the editor
   * left pending wins, and otherwise the stored settings replace these.
   * Call the returned function once, when the editor closes, after its
   * last edit.
   */
  hold(): () => void {
    this.holds++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holds--;
      if (this.holds > 0 || !this.reloadWaiting) return;
      this.reloadWaiting = false;
      void this.reload();
    };
  }
}
