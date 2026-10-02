/**
 * What the page's controls do to the workspace: open a note, show its
 * menu, preview it on hover, create a note, and rediscover one. Kept out
 * of the views so the home page and the Bases view behave the same.
 */

import { Menu, Notice, type App, type HoverParent, type TFile } from "obsidian";
import { forgottenNotes } from "../compose/rank";
import { untitledPath } from "../compose/vault";
import type { HomeCardsSettings } from "../settings/schema";
import type { CardActions } from "./card";

/** Where a click opens a note: in place, or a new tab with a modifier. */
function leafFor(app: App, newLeaf: boolean) {
  return app.workspace.getLeaf(newLeaf ? "tab" : false);
}

/**
 * Card behavior that matches the rest of Obsidian: click to open, right
 * click for the standard file menu, and hover preview through the Page
 * Preview core plugin, which applies its own modifier-key setting for
 * `source`.
 */
export function cardActions(app: App, hoverParent: HoverParent, source: string): CardActions {
  return {
    open: (file, newLeaf) => void leafFor(app, newLeaf).openFile(file),
    menu: (file, evt) => showFileMenu(app, file, evt, source),
    hover: (file, evt, el) =>
      app.workspace.trigger("hover-link", {
        event: evt,
        source,
        hoverParent,
        targetEl: el,
        linktext: file.path,
        sourcePath: "",
      }),
  };
}

/**
 * The opening choices Obsidian's file explorer offers, then whatever
 * Obsidian and other plugins add for a file (bookmarking, revealing it in
 * a file browser, and so on), through the standard file-menu event.
 */
function showFileMenu(app: App, file: TFile, evt: MouseEvent, source: string): void {
  const menu = new Menu();
  const open = (title: string, icon: string, where: "tab" | "split" | "window") =>
    menu.addItem((item) =>
      item
        .setSection("open")
        .setTitle(title)
        .setIcon(icon)
        .onClick(() => void app.workspace.getLeaf(where).openFile(file))
    );
  open("Open in new tab", "file-plus", "tab");
  open("Open to the right", "separator-vertical", "split");
  open("Open in new window", "picture-in-picture-2", "window");
  app.workspace.trigger("file-menu", menu, file, source);

  // A menu key or Shift+F10 fires contextmenu with no pointer position.
  if (evt.clientX === 0 && evt.clientY === 0 && evt.target instanceof HTMLElement) {
    const rect = evt.target.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left + 16, y: rect.top + 16 });
  } else {
    menu.showAtMouseEvent(evt);
  }
}

/**
 * Create an empty note where Obsidian's "Default location for new notes"
 * setting puts it, open it, and select its title for naming.
 */
export async function createNote(app: App, newLeaf: boolean): Promise<void> {
  const folder = app.fileManager.getNewFileParent("");
  const path = untitledPath(folder.isRoot() ? "" : folder.path, (p) => !!app.vault.getAbstractFileByPath(p));
  const file = await app.vault.create(path, "");
  await leafFor(app, newLeaf).openFile(file, { active: true, eState: { rename: "all" } });
}

/** Open a random note from the Rediscover pool. */
export function rediscoverNote(app: App, settings: HomeCardsSettings, newLeaf: boolean): void {
  const months = settings.rediscoverMonths;
  const pool = forgottenNotes(app.vault.getMarkdownFiles(), new Date(), months);
  if (!pool.length) {
    new Notice(`Every note has changed in the last ${months} ${months === 1 ? "month" : "months"}.`);
    return;
  }
  const file = pool[Math.floor(Math.random() * pool.length)];
  void leafFor(app, newLeaf).openFile(file);
}
