/**
 * Card and section DOM. Pure functions of their inputs: no view instance,
 * no plugin handle, so the home view and the Bases view produce the same
 * markup from the same model.
 */

import { Keymap, setIcon, setTooltip, type PaneType, type TFile } from "obsidian";
import type { CardItem } from "../compose/card";
import type { HomeCardsSettings, SectionKind } from "../settings/schema";

export type CardOptions = Pick<HomeCardsSettings, "showGlyph" | "showRubric" | "showDeks">;

/** What a card does when used; render/actions.ts supplies the real ones. */
export interface CardActions {
  /** Open the note in place, or where Obsidian's modifier rules say. */
  open: (file: TFile, where: PaneType | false) => void;
  /** Show the note's context menu; the context says which section the card is in. */
  menu?: (file: TFile, evt: MouseEvent, context: CardMenuContext) => void;
  /** Hover preview: told when the pointer enters and leaves a card. */
  hover?: HoverTracker;
}

/** Where a card's menu was opened, so it can offer what fits there. */
export interface CardMenuContext {
  sectionKind?: SectionKind;
  /** Other sections on the page that can take the card, with the change each makes. */
  moves?: readonly SectionMove[];
}

/** A section a card can move to: its heading, the change in words, and the change itself. */
export interface SectionMove {
  title: string;
  change: string;
  run: (file: TFile) => void;
}

/**
 * The card being dragged, if any. Browsers hide a drag's data until the
 * drop, so the drop targets read the source from here while it moves.
 */
let dragging: { path: string; sectionId: string } | null = null;

/** Our own drag type: a drop target accepts only Home Cards cards. */
const DRAG_TYPE = "application/x-home-cards-note";

/** Follows the card under the pointer; see render/actions.ts. */
export interface HoverTracker {
  enter: (file: TFile, el: HTMLElement, evt: MouseEvent) => void;
  leave: (el: HTMLElement) => void;
  /** Show the preview for a card without the pointer, as from the keyboard. */
  preview: (file: TFile, el: HTMLElement) => void;
}

const NO_DEK = "No opening sentence.";

/** Where Obsidian's modifier rules send an open: in place, a tab, a split or a window. */
export function paneFor(evt: MouseEvent | KeyboardEvent): PaneType | false {
  const where = Keymap.isModEvent(evt);
  return where === true ? "tab" : where;
}

/**
 * A card image: decorative (the title names the note), loaded lazily and
 * decoded off the main thread. `onFail` runs when the file cannot load.
 */
function renderImage(parent: HTMLElement, src: string, onFail: () => void): HTMLImageElement {
  const img = parent.createEl("img", { attr: { src, alt: "", loading: "lazy", decoding: "async", draggable: "false" } });
  img.addEventListener("error", onFail, { once: true });
  return img;
}

/**
 * The card's media beside its title: the note's image, or, for a note
 * without one, a tile with its type icon or initial in the same place.
 * An image that fails to load becomes the tile.
 */
function renderMedia(head: HTMLElement, card: CardItem): void {
  const tile = () => {
    const el = createSpan({ cls: "hc-thumb is-tile", attr: { "aria-hidden": "true" } });
    if (card.icon) setIcon(el, card.icon);
    if (!el.firstElementChild) el.setText(card.title.charAt(0).toUpperCase());
    return el;
  };
  if (!card.image) {
    head.prepend(tile());
    return;
  }
  const img = renderImage(head, card.image, () => img.replaceWith(tile()));
  img.addClass("hc-thumb");
  head.prepend(img);
}

function renderGlyph(head: HTMLElement, card: CardItem): HTMLElement {
  const glyph = head.createSpan({ cls: "hc-glyph" });
  if (card.icon) {
    setIcon(glyph, card.icon);
    // setIcon is silent on an unknown name; confirm it drew something.
    if (glyph.firstElementChild) {
      glyph.addClass("has-icon");
      return glyph;
    }
  }
  glyph.setText(card.title.charAt(0).toUpperCase());
  return glyph;
}

/**
 * Type badge first, then tags: one wrapping row of one element, so the
 * two share a baseline. Omitted entirely when there is nothing to show.
 */
function renderPills(parent: HTMLElement, card: CardItem, opts: CardOptions): void {
  const type = opts.showRubric ? card.rubric : "";
  if (!type && !card.tags.length) return;
  const pills = parent.createDiv({ cls: "hc-pills" });
  if (type) pills.createSpan({ cls: "hc-pill is-type", text: type });
  for (const t of card.tags) pills.createSpan({ cls: "hc-pill is-tag", text: t });
}

function renderDek(el: HTMLElement, card: CardItem): void {
  if (card.dek === null) {
    // Not fetched yet: tag the element for the lazy filler.
    const dek = el.createEl("p", { cls: "hc-dek" });
    dek.dataset.hcDekPath = card.file.path;
    dek.dataset.hcPending = "";
    return;
  }
  el.createEl("p", {
    cls: card.dek ? "hc-dek" : "hc-dek is-empty",
    text: card.dek || NO_DEK,
  });
}

/** Fill a lazily rendered dek, in the same voice the eager path uses. */
export function settleDek(el: HTMLElement, dek: string): void {
  delete el.dataset.hcPending;
  el.toggleClass("is-empty", !dek);
  el.setText(dek || NO_DEK);
}

function renderCard(
  parent: HTMLElement,
  card: CardItem,
  opts: CardOptions,
  actions: CardActions,
  context: CardMenuContext,
  dragFrom: string | null
): HTMLElement {
  const el = parent.createEl("article", { cls: "hc-card" });
  // Every card in a section that shows images has media beside its title:
  // the grid shows it for thumbnails, and the rows layout for covers too,
  // since a cover would break the list into tiles. Without media, the
  // glyph setting decides.
  const media = card.imageSlot !== "none";
  el.toggleClass("has-media", media);
  el.toggleClass("has-thumb", card.imageSlot === "thumbnail");
  el.toggleClass("has-glyph", !media && opts.showGlyph);
  el.dataset.search = card.search;
  el.dataset.hcPath = card.file.path;
  el.tabIndex = 0;

  if (card.image && card.imageMode === "cover") {
    el.addClass("has-cover");
    const cover = el.createDiv({ cls: "hc-cover" });
    renderImage(cover, card.image, () => {
      cover.remove();
      el.removeClass("has-cover");
    });
  }
  const head = el.createDiv({ cls: "hc-card-head" });
  const text = head.createDiv({ cls: "hc-card-headtext" });
  if (media) renderMedia(head, card);
  else if (opts.showGlyph) head.prepend(renderGlyph(head, card));
  text.createEl("h3", { cls: "hc-title", text: card.title });
  renderPills(text, card, opts);

  if (opts.showDeks) renderDek(el, card);
  if (card.meta) el.createEl("footer", { cls: "hc-foot", text: card.meta });

  const go = (evt: MouseEvent | KeyboardEvent) => actions.open(card.file, paneFor(evt));
  el.addEventListener("click", go);
  // A middle click opens a new tab, as it does on a link.
  el.addEventListener("auxclick", (evt) => {
    if (evt.button === 1) actions.open(card.file, "tab");
  });
  // Enter opens. Space belongs to the page's keys (preview); see keyboard.ts.
  el.addEventListener("keydown", (evt) => {
    if (evt.key !== "Enter") return;
    evt.preventDefault();
    go(evt);
  });
  const { menu, hover } = actions;
  if (menu) {
    el.addEventListener("contextmenu", (evt) => {
      evt.preventDefault();
      menu(card.file, evt, context);
    });
  }
  if (dragFrom !== null) {
    el.draggable = true;
    el.addEventListener("dragstart", (evt) => {
      dragging = { path: card.file.path, sectionId: dragFrom };
      // A wikilink as plain text, so a card dropped into a note links it.
      evt.dataTransfer?.setData("text/plain", `[[${card.file.basename}]]`);
      evt.dataTransfer?.setData(DRAG_TYPE, card.file.path);
      el.addClass("is-dragging");
    });
    el.addEventListener("dragend", () => {
      dragging = null;
      el.removeClass("is-dragging");
    });
  }
  if (hover) {
    // mouseenter, not mouseover: one event per visit to the card, not one
    // per child element the pointer crosses.
    el.addEventListener("mouseenter", (evt) => hover.enter(card.file, el, evt));
    el.addEventListener("mouseleave", () => hover.leave(el));
  }
  return el;
}

export interface SectionOptions {
  /** Shown in place of the grid when the section has no cards. */
  emptyText?: string;
  /** Held-back cards, rendered hidden after the visible ones. */
  more?: readonly CardItem[];
  /** Makes the heading fold the section; called with the new state. */
  fold?: { collapsed: boolean; onToggle: (collapsed: boolean) => void };
  /**
   * Adds "See more" and "Show fewer" under the cards. The caller decides
   * which cards and buttons show (see the home view's applyFilter).
   */
  paging?: { more: () => void; fewer: () => void };
  /** Handed to the card menu: the kind of section the cards are in. */
  menuContext?: CardMenuContext;
  /** Adds a + to the heading that creates a note belonging here. */
  create?: { tooltip: string; run: (evt: MouseEvent) => void };
  /** Lets cards be dragged out; the id tells a drop where they came from. */
  dragId?: string;
  /** Accepts dropped cards, making the stated change to each. */
  drop?: { hint: string; run: (path: string) => void };
}

/**
 * One titled section of cards. A blank title draws no heading row (an
 * ungrouped Bases result).
 *
 * Every card, held back or not, carries `data-hc-index`; the caller
 * decides which show (see the home view's paint), so filtering can reach
 * held-back cards too.
 */
export function renderSection(
  parent: HTMLElement,
  title: string,
  cards: readonly CardItem[],
  opts: CardOptions,
  actions: CardActions,
  options: SectionOptions = {}
): HTMLElement {
  const { emptyText = "", more = [], fold, paging, menuContext = {}, create, dragId, drop } = options;
  const section = parent.createDiv({ cls: "hc-section" });
  section.dataset.hcVisible = String(cards.length);

  if (title) renderHead(section, title, cards.length, fold, create);
  if (drop && dragId) acceptDrops(section, dragId, drop);

  if (!cards.length && !more.length && emptyText) {
    section.createDiv({ cls: "hc-empty", text: emptyText });
    return section;
  }
  const grid = section.createDiv({ cls: "hc-grid" });
  [...cards, ...more].forEach((card, i) => {
    renderCard(grid, card, opts, actions, menuContext, dragId ?? null).dataset.hcIndex = String(i);
  });
  if (more.length && paging) {
    const row = section.createDiv({ cls: "hc-more-row" });
    pagingButton(row, "hc-more", "See more", "chevron-down", paging.more);
    pagingButton(row, "hc-less", "Show fewer", "chevron-up", paging.fewer);
  }
  return section;
}

function pagingButton(row: HTMLElement, cls: string, text: string, icon: string, run: () => void): void {
  const btn = row.createEl("button", { cls });
  setIcon(btn.createSpan({ cls: "hc-more-icon" }), icon);
  btn.createSpan({ text });
  btn.addEventListener("click", run);
}

/**
 * The heading row: title, card count and, for a foldable section, the
 * fold chevron. The whole row toggles the fold; the chevron is the
 * keyboard-reachable control and carries the state for screen readers.
 */
function renderHead(
  section: HTMLElement,
  title: string,
  count: number,
  fold: SectionOptions["fold"],
  create: SectionOptions["create"]
): void {
  const head = section.createDiv({ cls: "hc-section-head" });
  head.createEl("h2", { text: title });
  head.createSpan({ cls: "hc-count", text: String(count) });
  if (create) {
    const add = head.createEl("button", { cls: "hc-create clickable-icon" });
    setIcon(add, "plus");
    setTooltip(add, create.tooltip, { placement: "top" });
    add.addEventListener("click", (evt) => {
      // The heading folds the section; the + only creates.
      evt.stopPropagation();
      create.run(evt);
    });
  }
  if (!fold) return;

  head.addClass("is-foldable");
  const toggle = head.createEl("button", { cls: "hc-fold clickable-icon" });
  setIcon(toggle, "chevron-down");
  const paint = (collapsed: boolean) => {
    section.toggleClass("is-collapsed", collapsed);
    toggle.setAttr("aria-expanded", String(!collapsed));
    setTooltip(toggle, collapsed ? "Expand section" : "Collapse section", { placement: "left" });
  };
  paint(fold.collapsed);
  head.addEventListener("click", () => {
    const collapsed = !section.hasClass("is-collapsed");
    paint(collapsed);
    fold.onToggle(collapsed);
  });
}

/**
 * Make a section a drop target for cards from other sections. While a
 * card is over it, the section shows the change a drop would make; a
 * card from this same section, or anything that is not a card, is not
 * accepted.
 */
function acceptDrops(section: HTMLElement, sectionId: string, drop: NonNullable<SectionOptions["drop"]>): void {
  const accepts = (evt: DragEvent) =>
    dragging !== null && dragging.sectionId !== sectionId && (evt.dataTransfer?.types.includes(DRAG_TYPE) ?? false);
  let hint: HTMLElement | null = null;
  const clear = () => {
    section.removeClass("is-drop-target");
    hint?.remove();
    hint = null;
  };
  section.addEventListener("dragover", (evt) => {
    if (!accepts(evt)) return;
    evt.preventDefault();
    if (evt.dataTransfer) evt.dataTransfer.dropEffect = "move";
    if (!hint) {
      section.addClass("is-drop-target");
      hint = section.createDiv({ cls: "hc-drop-hint", text: drop.hint });
      section.find(".hc-section-head")?.after(hint);
    }
  });
  section.addEventListener("dragleave", (evt) => {
    if (!section.contains(evt.relatedTarget as Node | null)) clear();
  });
  section.addEventListener("drop", (evt) => {
    const from = dragging;
    clear();
    if (!from || !accepts(evt)) return;
    evt.preventDefault();
    drop.run(from.path);
  });
  section.addEventListener("dragend", clear);
}
