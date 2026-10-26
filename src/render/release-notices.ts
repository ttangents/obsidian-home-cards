/**
 * The release marker and the home page's notice after an update: which
 * releases the notice announces, and what marks them seen. The rule for
 * when a release announces itself lives in settings/release-notes.ts;
 * this module applies it to this device's local storage and the synced
 * settings, and opens the window of notes (whats-new.ts).
 */

import type { App } from "obsidian";
import { checkForUpdate, compareVersions, laterVersion, recentNotes, type ReleaseNote } from "../settings/release-notes";
import type { SettingsAccess } from "../settings/store";
import { WhatsNewModal } from "./whats-new";

/** Local-storage key for this device's copy of the release marker; see release-notes.ts. */
const RELEASE_KEY = "home-cards-release-seen";

export class ReleaseNotices {
  /**
   * Releases the home page announces, newest first; empty once the reader
   * has read or dismissed them, or when there is nothing new.
   */
  notes: ReleaseNote[] = [];

  constructor(
    private readonly app: App,
    private readonly store: SettingsAccess,
    /** The installed version, from the manifest. */
    private readonly version: string,
    /** Redraws the open pages. */
    private readonly redraw: () => void
  ) {}

  /** At load: queue the notice for unseen releases, or mark this version seen. */
  review(firstRun: boolean): void {
    const decision = checkForUpdate({
      current: this.version,
      seen: this.seen(),
      firstRun,
      enabled: this.store.settings.showReleaseNotes,
    });
    if (decision.kind === "announce") this.notes = decision.notes;
    else if (decision.kind === "record") this.markSeen();
  }

  /** After settings arrive from another device, which may have read or dismissed the notice. */
  reconcile(): void {
    if (this.notes.length && compareVersions(this.seen(), this.version) >= 0) this.notes = [];
  }

  /** Close the home page's notice without reading the notes. */
  dismiss(): void {
    if (!this.notes.length) return;
    this.notes = [];
    if (!this.markSeen()) this.redraw();
  }

  /**
   * Open the release notes: the unseen ones when the home page announces
   * them, and closing the window marks them read; otherwise the latest.
   */
  show(): void {
    const unseen = this.notes.length > 0;
    const notes = unseen ? this.notes : recentNotes(this.version);
    new WhatsNewModal(this.app, notes, unseen ? () => this.dismiss() : undefined).open();
  }

  /** The newest release seen here: the later of the synced and the local marker. */
  private seen(): string {
    const local: unknown = this.app.loadLocalStorage(RELEASE_KEY);
    return laterVersion(this.store.settings.lastShownVersion, typeof local === "string" ? local : "");
  }

  /**
   * Mark the installed version seen, here and in synced settings, never
   * moving a marker back. Returns true when it saves, which redraws the views.
   */
  private markSeen(): boolean {
    const local: unknown = this.app.loadLocalStorage(RELEASE_KEY);
    this.app.saveLocalStorage(RELEASE_KEY, laterVersion(typeof local === "string" ? local : "", this.version));
    const settings = this.store.settings;
    const synced = laterVersion(settings.lastShownVersion, this.version);
    if (synced === settings.lastShownVersion) return false;
    settings.lastShownVersion = synced;
    void this.store.commit();
    return true;
  }
}
