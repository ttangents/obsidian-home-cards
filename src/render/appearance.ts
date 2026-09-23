/**
 * Settings that shape how a card surface looks, expressed as attributes
 * and custom properties on the view root. styles.css keys every visual
 * treatment off these; both views call this, so they cannot disagree.
 */

import type { HomeCardsSettings } from "../settings/schema";

export function applyAppearance(root: HTMLElement, s: HomeCardsSettings): void {
  root.addClass("home-cards");
  root.dataset.surface = s.cardSurface;
  // Plain sets no attribute, so no background rule can fire.
  if (s.background === "plain") delete root.dataset.pattern;
  else root.dataset.pattern = s.background;
  root.toggleClass("hc-accent-rubrics", s.accentRubrics);
  root.style.setProperty("--hc-card-min", `${s.cardMinWidth}px`);
  root.style.setProperty("--hc-dek-lines", String(s.dekLines));
}
