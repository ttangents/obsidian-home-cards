/**
 * Card and section DOM. Pure functions of their inputs: no view instance,
 * no plugin handle, so the home view and the Bases view produce the same
 * markup from the same model.
 */

import { setIcon, setTooltip, type TFile } from "obsidian";
import type { CardItem } from "../compose/card";
import type { HomeCardsSettings } from "../settings/schema";

export type CardOptions = Pick<HomeCardsSettings, "showGlyph" | "showRubric" | "showDeks">;

/** What a card does when used; render/actions.ts supplies the real ones. */
export interface CardActions {
  /** Open the note, in a new tab when a modifier key is held. */
  open: (file: TFile, newLeaf: boolean) => void;
  /** Show the note's context menu. */
  menu?: (file: TFile, evt: MouseEvent) => void;
  /** Hover preview: told when the pointer enters and leaves a card. */
  hover?: HoverTracker;
}

/** Follows the card under the pointer; see render/actions.ts. */
export interface HoverTracker {
  enter: (file: TFile, el: HTMLElement, evt: MouseEvent) => void;
  leave: (el: HTMLElement) => void;
}

const NO_DEK = "No opening sentence.";

function renderGlyph(head: HTMLElement, card: CardItem): void {
  const glyph = head.createSpan({ cls: "hc-glyph" });
  if (card.icon) {
    setIcon(glyph, card.icon);
    // setIcon is silent on an unknown name; confirm it drew something.
    if (glyph.firstElementChild) {
      glyph.addClass("has-icon");
      return;
    }
  }
  glyph.setText(card.title.charAt(0).toUpperCase());
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
  actions: CardActions
): HTMLElement {
  const el = parent.createEl("article", { cls: "hc-card" });
  el.dataset.search = card.search;
  el.tabIndex = 0;

  const head = el.createDiv({ cls: "hc-card-head" });
  if (opts.showGlyph) renderGlyph(head, card);
  const text = head.createDiv({ cls: "hc-card-headtext" });
  text.createEl("h3", { cls: "hc-title", text: card.title });
  renderPills(text, card, opts);

  if (opts.showDeks) renderDek(el, card);
  if (card.meta) el.createEl("footer", { cls: "hc-foot", text: card.meta });

  const go = (evt: MouseEvent | KeyboardEvent) => actions.open(card.file, evt.metaKey || evt.ctrlKey);
  el.addEventListener("click", go);
  el.addEventListener("keydown", (evt) => {
    if (evt.key !== "Enter" && evt.key !== " ") return;
    evt.preventDefault();
    go(evt);
  });
  const { menu, hover } = actions;
  if (menu) {
    el.addEventListener("contextmenu", (evt) => {
      evt.preventDefault();
      menu(card.file, evt);
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
  const { emptyText = "", more = [], fold, paging } = options;
  const section = parent.createDiv({ cls: "hc-section" });
  section.dataset.hcVisible = String(cards.length);

  if (title) renderHead(section, title, cards.length, fold);

  if (!cards.length && !more.length && emptyText) {
    section.createDiv({ cls: "hc-empty", text: emptyText });
    return section;
  }
  const grid = section.createDiv({ cls: "hc-grid" });
  [...cards, ...more].forEach((card, i) => {
    renderCard(grid, card, opts, actions).dataset.hcIndex = String(i);
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
  fold: SectionOptions["fold"]
): void {
  const head = section.createDiv({ cls: "hc-section-head" });
  head.createEl("h2", { text: title });
  head.createSpan({ cls: "hc-count", text: String(count) });
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
