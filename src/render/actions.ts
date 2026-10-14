/**
 * What the page's controls do to the workspace: open a note, show its
 * menu, preview it on hover, create a note, and rediscover one. Kept out
 * of the views so the home page and the Bases view behave the same.
 */

import { Menu, normalizePath, Notice, type App, type Component, type HoverParent, type TFile } from "obsidian";
import { forgottenNotes } from "../compose/rank";
import { untitledPath } from "../compose/vault";
import type { HomeCardsSettings } from "../settings/schema";
import type { CardActions, HoverTracker } from "./card";

/** Where a click opens a note: in place, or a new tab with a modifier. */
function leafFor(app: App, newLeaf: boolean) {
  return app.workspace.getLeaf(newLeaf ? "tab" : false);
}

/**
 * Card behavior that matches the rest of Obsidian: click to open, right
 * click for the standard file menu, and hover preview.
 *
 * `owner` is the view the cards live in: it holds the preview's key
 * listener and releases it when the view closes. Call once per view, not
 * once per render.
 */
export function cardActions(
  app: App,
  owner: Component,
  hoverParent: HoverParent,
  source: string
): CardActions {
  return {
    open: (file, newLeaf) => void leafFor(app, newLeaf).openFile(file),
    menu: (file, evt) => showFileMenu(app, file, evt, source),
    hover: hoverTracker(app, owner, hoverParent, source),
  };
}

/**
 * Hover preview through the Page Preview core plugin, which applies its
 * own modifier-key setting for `source` (by default, Cmd or Ctrl held).
 * Obsidian previews a link when the pointer arrives with the modifier
 * held, and also when the modifier goes down while the pointer rests on
 * the link. The tracker remembers the card under the pointer so cards get
 * both, and asks once per visit rather than once per child element.
 */
function hoverTracker(app: App, owner: Component, hoverParent: HoverParent, source: string): HoverTracker {
  let current: { file: TFile; el: HTMLElement } | null = null;
  // The pointer's last position over a card. Page Preview reads the
  // position from the event it receives, and a key press carries none.
  let x = 0;
  let y = 0;

  const show = (event: MouseEvent) => {
    // A recompose may have replaced the card while the pointer sat on it.
    if (!current?.el.isConnected) return;
    app.workspace.trigger("hover-link", {
      event,
      source,
      hoverParent,
      targetEl: current.el,
      linktext: current.file.path,
      sourcePath: "",
    });
  };

  // Listeners go on the document the cards are in, which is a popout
  // window's own document when the view lives there. One set per
  // document, released with the view.
  const listening = new WeakSet<Document>();
  const listen = (doc: Document) => {
    if (listening.has(doc)) return;
    listening.add(doc);
    owner.registerDomEvent(doc, "mousemove", (evt) => {
      if (!current) return;
      x = evt.clientX;
      y = evt.clientY;
    });
    owner.registerDomEvent(doc, "keydown", (evt) => {
      if (!current || evt.repeat || (evt.key !== "Meta" && evt.key !== "Control")) return;
      // The key press as a pointer event at the pointer's position, with
      // the modifier state Page Preview checks.
      const view = doc.defaultView ?? undefined;
      show(new MouseEvent("mouseover", { view, clientX: x, clientY: y, metaKey: evt.metaKey, ctrlKey: evt.ctrlKey }));
    });
  };

  return {
    enter: (file, el, evt) => {
      listen(el.ownerDocument);
      current = { file, el };
      x = evt.clientX;
      y = evt.clientY;
      show(evt);
    },
    leave: (el) => {
      if (current?.el === el) current = null;
    },
  };
}

/**
 * The opening choices Obsidian's file explorer offers that the standard
 * file menu leaves to its caller, then the standard file menu itself:
 * through the file-menu event, Obsidian and other plugins add their items
 * (opening in a new window, bookmarking, revealing the file, and so on).
 */
function showFileMenu(app: App, file: TFile, evt: MouseEvent, source: string): void {
  const menu = new Menu();
  const open = (title: string, icon: string, where: "tab" | "split") =>
    menu.addItem((item) =>
      item
        .setSection("open")
        .setTitle(title)
        .setIcon(icon)
        .onClick(() => void app.workspace.getLeaf(where).openFile(file))
    );
  open("Open in new tab", "file-plus", "tab");
  open("Open to the right", "separator-vertical", "split");
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
  const exists = (p: string) => !!app.vault.getAbstractFileByPath(normalizePath(p));
  const path = normalizePath(untitledPath(folder.isRoot() ? "" : folder.path, exists));
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
