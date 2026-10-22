/**
 * What's new: the home page's notice after an update, and the window of
 * release notes it opens. When the notice appears, and what marks it
 * read, is decided in settings/release-notes.ts and main.ts; this module
 * only draws.
 *
 * The notes are plain text set with `setText`, never parsed as HTML or
 * Markdown, and the window loads nothing from the web. Its links open the
 * releases page, and the page of a companion plugin, in the browser.
 */

import { Modal, setIcon, setTooltip, type App } from "obsidian";
import { announcementTitle, RELEASE_GROUPS, RELEASES_URL, type ReleaseNote } from "../settings/release-notes";

export interface NoticeActions {
  open(): void;
  dismiss(): void;
}

/** Fill `el` with the notice for `notes`, the newest first. */
export function renderUpdateNotice(el: HTMLElement, notes: readonly ReleaseNote[], actions: NoticeActions): void {
  el.empty();
  const newest = notes[0];
  if (!newest) return;
  el.setAttr("role", "status");

  const icon = el.createSpan({ cls: "hc-update-icon", attr: { "aria-hidden": "true" } });
  setIcon(icon, "sparkles");
  // Older Obsidian builds ship a Lucide set without sparkles.
  if (!icon.firstElementChild) setIcon(icon, "star");

  const text = el.createDiv({ cls: "hc-update-text" });
  text.createSpan({ cls: "hc-update-title", text: announcementTitle(notes) });
  text.createSpan({ cls: "hc-update-headline", text: newest.headline });

  const open = el.createEl("button", { cls: "hc-update-open", text: "See what's new" });
  open.addEventListener("click", () => actions.open());

  const close = el.createEl("button", { cls: "hc-update-close clickable-icon" });
  setIcon(close, "x");
  setTooltip(close, "Dismiss", { placement: "bottom" });
  close.addEventListener("click", () => actions.dismiss());
}

/** The release notes, newest first. `onDone` runs when the window closes, however it closes. */
export class WhatsNewModal extends Modal {
  constructor(
    app: App,
    private readonly notes: readonly ReleaseNote[],
    private readonly onDone?: () => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("What's new in Home Cards");
    this.modalEl.addClass("hc-whats-new");
    const { contentEl } = this;
    contentEl.empty();

    for (const note of this.notes) {
      const release = contentEl.createDiv({ cls: "hc-release" });
      const head = release.createDiv({ cls: "hc-release-head" });
      head.createEl("h3", { text: note.version });
      head.createSpan({ cls: "hc-release-date", text: formatReleaseDate(note.date) });
      release.createEl("p", { cls: "hc-release-headline", text: note.headline });
      for (const group of RELEASE_GROUPS) {
        const items = note[group.key];
        if (!items?.length) continue;
        release.createDiv({ cls: "hc-release-group", text: group.label });
        const list = release.createEl("ul");
        for (const item of items) list.createEl("li", { text: item });
      }
      const other = note.worksWith;
      if (other) {
        release.createDiv({ cls: "hc-release-group", text: `Works with ${other.plugin}` });
        const intro = release.createEl("p", { cls: "hc-release-intro" });
        intro.appendText("Home Cards works well with ");
        intro.createEl("a", { text: other.plugin, href: other.url });
        intro.appendText(`, my other plugin, ${other.about}. Install it from Settings → Community plugins. You don't need it to use Home Cards. If you use both:`);
        const list = release.createEl("ul");
        for (const item of other.items) list.createEl("li", { text: item });
      }
    }

    // Outside the scrolling notes, so the way out stays in view.
    const footer = this.modalEl.createDiv({ cls: "hc-whats-new-footer" });
    footer.createEl("a", { text: "All releases", href: RELEASES_URL });
    const done = footer.createEl("button", { cls: "mod-cta", text: "Done" });
    done.addEventListener("click", () => this.close());
    // The button, not the first link, takes focus: Enter closes the window.
    window.setTimeout(() => done.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
    this.modalEl.find(".hc-whats-new-footer")?.remove();
    this.onDone?.();
  }
}

/** "2026-10-20" as the reader's locale writes a date; the text itself when it is not one. */
function formatReleaseDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}
