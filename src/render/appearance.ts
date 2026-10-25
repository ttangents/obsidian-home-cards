/**
 * Settings that shape how a card surface looks, expressed as attributes
 * and custom properties on the view root. styles.css keys every visual
 * treatment off these; both views call this, so they cannot disagree.
 */

import type HomeCardsPlugin from "../main";
import { selectedCustom } from "../settings/custom-background";
import { BACKGROUND_PROPS, backgroundProps, backgroundUrl } from "./backgrounds";

export function applyAppearance(root: HTMLElement, plugin: HomeCardsPlugin): void {
  const s = plugin.settings;
  root.addClass("home-cards");
  root.dataset.surface = s.cardSurface;

  const custom = selectedCustom(s);
  if (custom) {
    // The image and its veil travel as properties on the root, which win
    // over any built-in pattern's.
    root.dataset.pattern = "custom";
    root.dataset.fit = custom.fit;
    root.setCssProps(backgroundProps(backgroundUrl(plugin, custom), custom));
  } else {
    delete root.dataset.fit;
    for (const prop of BACKGROUND_PROPS) root.style.removeProperty(prop);
    // Plain sets no attribute, so no background rule can fire.
    if (s.background === "plain") delete root.dataset.pattern;
    else root.dataset.pattern = s.background;
  }

  root.toggleClass("hc-accent-rubrics", s.accentRubrics);
  root.setCssProps({
    "--_hc-card-min": `${s.cardMinWidth}px`,
    "--_hc-dek-lines": String(s.dekLines),
  });
}
