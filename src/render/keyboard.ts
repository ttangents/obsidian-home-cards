/**
 * Keys on a Home Cards page, through the view's own key scope, which
 * Obsidian makes active only while the page has focus:
 *
 *   / focuses the filter box
 *   j or ↓, k or ↑  next or previous card (↓ and ↑ follow the grid's columns)
 *   ← →             previous or next card
 *   Enter           open the card (with Cmd or Ctrl: a new tab; see paneFor)
 *   Space           preview the card, through Page Preview
 *   p               pin or unpin the card
 *
 * Typing in the filter box is left alone: a key there types.
 */

import type { Scope } from "obsidian";

export interface CardKeyActions {
  focusSearch(): void;
  preview(card: HTMLElement): void;
  togglePin(path: string): void;
}

type Direction = "next" | "prev" | "down" | "up";

/** Cards a reader can see now: not filtered out, not inside a folded section. */
function visibleCards(root: HTMLElement): HTMLElement[] {
  return root.findAll(".hc-card").filter((el) => !el.hasClass("is-hidden") && el.offsetParent !== null);
}

/** The card to move to: in page order, or the nearest in the row below or above. */
export function nextCard(cards: readonly HTMLElement[], from: HTMLElement | null, dir: Direction): HTMLElement | null {
  if (!cards.length) return null;
  const at = from ? cards.indexOf(from) : -1;
  if (at < 0) return cards[0];
  if (dir === "next") return cards[Math.min(at + 1, cards.length - 1)];
  if (dir === "prev") return cards[Math.max(at - 1, 0)];
  const box = from?.getBoundingClientRect();
  if (!box) return null;
  const centre = (r: DOMRect) => r.left + r.width / 2;
  const rows = cards
    .filter((c) => c !== from)
    .map((c) => ({ c, r: c.getBoundingClientRect() }))
    .filter(({ r }) => (dir === "down" ? r.top >= box.bottom - 2 : r.bottom <= box.top + 2));
  if (!rows.length) return from;
  // The nearest row first, then the card closest to the same column.
  const edge = dir === "down" ? Math.min(...rows.map(({ r }) => r.top)) : Math.max(...rows.map(({ r }) => r.bottom));
  const row = rows.filter(({ r }) => Math.abs((dir === "down" ? r.top : r.bottom) - edge) < 2);
  row.sort((a, b) => Math.abs(centre(a.r) - centre(box)) - Math.abs(centre(b.r) - centre(box)));
  return row[0]?.c ?? from;
}

/** Register the page's keys in its scope. */
export function registerCardKeys(scope: Scope, root: () => HTMLElement | null, actions: CardKeyActions): void {
  const typing = (evt: KeyboardEvent) =>
    evt.target instanceof HTMLInputElement || evt.target instanceof HTMLTextAreaElement;
  const focused = (): HTMLElement | null => {
    const el = root()?.ownerDocument.activeElement;
    return el instanceof HTMLElement && el.hasClass("hc-card") ? el : null;
  };
  const move = (dir: Direction) => (evt: KeyboardEvent) => {
    const body = root();
    if (typing(evt) || !body) return true;
    const target = nextCard(visibleCards(body), focused(), dir);
    target?.focus();
    target?.scrollIntoView({ block: "nearest" });
    return false;
  };
  scope.register([], "/", (evt) => {
    if (typing(evt)) return true;
    actions.focusSearch();
    return false;
  });
  scope.register([], "j", move("next"));
  scope.register([], "k", move("prev"));
  scope.register([], "ArrowDown", move("down"));
  scope.register([], "ArrowUp", move("up"));
  scope.register([], "ArrowRight", move("next"));
  scope.register([], "ArrowLeft", move("prev"));
  scope.register([], " ", (evt) => {
    const card = focused();
    if (typing(evt) || !card) return true;
    actions.preview(card);
    return false;
  });
  scope.register([], "p", (evt) => {
    const path = focused()?.dataset.hcPath;
    if (typing(evt) || !path) return true;
    actions.togglePin(path);
    return false;
  });
}
