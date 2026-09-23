/**
 * Card and section DOM. Pure functions of their inputs: no view instance,
 * no plugin handle, so the home view and the Bases view produce the same
 * markup from the same model.
 */

import { setIcon, type App, type TFile } from "obsidian";
import type { CardItem } from "../compose/card";
import type { HomeCardsSettings } from "../settings/schema";

export type CardOptions = Pick<HomeCardsSettings, "showGlyph" | "showRubric" | "showDeks">;
export type OpenNote = (file: TFile, newLeaf: boolean) => void;

const NO_DEK = "No opening sentence.";

/** Open a note in place, or in a new tab when a modifier is held. */
export function noteOpener(app: App): OpenNote {
  return (file, newLeaf) => void app.workspace.getLeaf(newLeaf ? "tab" : false).openFile(file);
}

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
  open: OpenNote
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

  const go = (evt: MouseEvent | KeyboardEvent) => open(card.file, evt.metaKey || evt.ctrlKey);
  el.addEventListener("click", go);
  el.addEventListener("keydown", (evt) => {
    if (evt.key !== "Enter" && evt.key !== " ") return;
    evt.preventDefault();
    go(evt);
  });
  return el;
}

/**
 * One titled section of cards. A blank title draws no heading row (an
 * ungrouped Bases result); `emptyText` stands in when there are no cards.
 */
export function renderSection(
  parent: HTMLElement,
  title: string,
  cards: readonly CardItem[],
  opts: CardOptions,
  open: OpenNote,
  emptyText = ""
): HTMLElement {
  const section = parent.createDiv({ cls: "hc-section" });
  if (title) {
    const head = section.createDiv({ cls: "hc-section-head" });
    head.createEl("h2", { text: title });
    head.createSpan({ cls: "hc-count", text: String(cards.length) });
  }
  if (!cards.length && emptyText) {
    section.createDiv({ cls: "hc-empty", text: emptyText });
    return section;
  }
  const grid = section.createDiv({ cls: "hc-grid" });
  for (const card of cards) renderCard(grid, card, opts, open);
  return section;
}
