/**
 * What the page's controls do to the workspace: open a note, show its
 * menu, preview it on hover, create a note, and rediscover one. Kept out
 * of the views so the home page and the Bases view behave the same.
 */

import { Menu, normalizePath, Notice, type App, type Component, type HoverParent, type PaneType, type TFile } from "obsidian";
import { forgottenNotes } from "../compose/rediscover";
import type { ScopeTest } from "../compose/scope";
import { notesIn, untitledPath } from "../compose/vault";
import { applyToFrontmatter, EMPTY_TEMPLATE, hasFacts, type NoteTemplate } from "../compose/templates";
import type { HomeCardsSettings } from "../settings/schema";
import type { CardActions, CardMenuContext, HoverTracker } from "./card";
import { pickProperty } from "./property-picker";

/**
 * Home Cards' marks, as the card menu offers them. The plugin supplies
 * these (see main.ts); each change saves and redraws the pages.
 */
export interface MarkActions {
  isPinned(path: string): boolean;
  togglePin(path: string): void;
  snooze(path: string, days: number): void;
  isQuiet(path: string): boolean;
  toggleQuiet(path: string): void;
}

/**
 * Where a note opens: in place, or where Obsidian's own modifier rules
 * send it (see `Keymap.isModEvent`): a new tab, a split or a window.
 */
function leafFor(app: App, where: PaneType | false) {
  return app.workspace.getLeaf(where);
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
  source: string,
  marks?: MarkActions
): CardActions {
  return {
    open: (file, where) => void leafFor(app, where).openFile(file),
    menu: (file, evt, context) => showFileMenu(app, file, evt, source, context, marks),
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
    preview: (file, el) => {
      // A modified pointer event at the card's centre: what Page Preview
      // reads when a modifier goes down over a link.
      const box = el.getBoundingClientRect();
      const view = el.ownerDocument.defaultView ?? undefined;
      current = { file, el };
      show(new MouseEvent("mouseover", { view, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2, metaKey: true, ctrlKey: true }));
      current = null;
    },
  };
}

/**
 * The opening choices Obsidian's file explorer offers that the standard
 * file menu leaves to its caller, then the standard file menu itself:
 * through the file-menu event, Obsidian and other plugins add their items
 * (opening in a new window, bookmarking, revealing the file, and so on).
 */
function showFileMenu(
  app: App,
  file: TFile,
  evt: MouseEvent,
  source: string,
  context: CardMenuContext,
  marks?: MarkActions
): void {
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
  if (marks) addMarkItems(menu, file.path, context, marks);
  for (const move of context.moves ?? []) {
    menu.addItem((i) =>
      i
        .setSection("action")
        .setTitle(`Move to ${move.title}`)
        .setIcon("arrow-right-to-line")
        .onClick(() => move.run(file))
    );
  }
  menu.addItem((i) =>
    i
      .setSection("action")
      .setTitle("Set a property…")
      .setIcon("list-plus")
      .onClick(() => pickProperty(app, file))
  );
  app.workspace.trigger("file-menu", menu, file, source);

  // A menu key or Shift+F10 fires contextmenu with no pointer position.
  if (evt.clientX === 0 && evt.clientY === 0 && evt.target instanceof HTMLElement) {
    const rect = evt.target.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left + 16, y: rect.top + 16 });
  } else {
    menu.showAtMouseEvent(evt);
  }
}

/** Pin, snooze and, in Rediscover, pass over. Home Cards' own state; the note is untouched. */
function addMarkItems(menu: Menu, path: string, context: CardMenuContext, marks: MarkActions): void {
  const item = (title: string, icon: string, run: () => void) =>
    menu.addItem((i) => i.setSection("action").setTitle(title).setIcon(icon).onClick(run));
  const pinned = marks.isPinned(path);
  item(pinned ? "Unpin from Home" : "Pin to Home", pinned ? "pin-off" : "pin", () => marks.togglePin(path));
  if (!pinned) {
    item("Snooze for a week", "alarm-clock", () => marks.snooze(path, 7));
    item("Snooze for a month", "alarm-clock", () => marks.snooze(path, 30));
  }
  if (context.sectionKind === "rediscover") {
    const quiet = marks.isQuiet(path);
    item(quiet ? "Rediscover again" : "Don't rediscover", quiet ? "eye" : "eye-off", () => marks.toggleQuiet(path));
  }
}

/**
 * Create a note, give it the template's facts, open it, and select its
 * title for naming. The note goes in the template's folder when it has one
 * that exists, and otherwise where Obsidian's "Default location for new
 * notes" setting puts it.
 */
export async function createNote(
  app: App,
  where: PaneType | false,
  template: NoteTemplate = EMPTY_TEMPLATE
): Promise<TFile> {
  const chosen = template.folder ? app.vault.getFolderByPath(template.folder) : null;
  const folder = chosen ?? app.fileManager.getNewFileParent("");
  const exists = (p: string) => !!app.vault.getAbstractFileByPath(normalizePath(p));
  const path = normalizePath(untitledPath(folder.isRoot() ? "" : folder.path, exists));
  const file = await app.vault.create(path, "");
  await applyTemplate(app, file, template);
  await leafFor(app, where).openFile(file, { active: true, eState: { rename: "all" } });
  return file;
}

/**
 * Write a template's tags and properties into a note's frontmatter through
 * Obsidian, which keeps the YAML valid and the note's other properties as
 * they were; see `applyToFrontmatter` for what changes. Resolves to what
 * changed, in words, or "" when the note already had it.
 */
export async function applyTemplate(app: App, file: TFile, template: NoteTemplate, from?: NoteTemplate): Promise<string> {
  if (!hasFacts(template)) return "";
  let done = "";
  await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    done = applyToFrontmatter(fm, template, from);
  });
  return done;
}

/** Open a random note from the Rediscover pool, limited to a page's notes. */
export function rediscoverNote(
  app: App,
  settings: HomeCardsSettings,
  where: PaneType | false,
  scope: ScopeTest | null = null
): void {
  const months = settings.rediscoverMonths;
  const pool = forgottenNotes(notesIn(app, scope), new Date(), months);
  if (!pool.length) {
    new Notice(`Every note has changed in the last ${months} ${months === 1 ? "month" : "months"}.`);
    return;
  }
  const file = pool[Math.floor(Math.random() * pool.length)];
  void leafFor(app, where).openFile(file);
}
