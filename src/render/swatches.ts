/**
 * The background picker: one swatch per entry in BACKGROUNDS, used by
 * both the settings tab and the home page's header picker, so the two
 * offer the same choices and write the same setting.
 *
 * Each swatch paints with the custom property the page itself uses, so a
 * preview cannot drift from the real background, and the theme's mode
 * selects the light or dark tile for the swatch exactly as it does for
 * the page.
 */

import type HomeCardsPlugin from "../main";
import { BACKGROUNDS } from "../settings/schema";

export interface BackgroundPicker {
  /** Move the selection mark to the stored background. */
  paint(): void;
}

/**
 * Draw the swatch grid into `parent`. A pick stores the choice, repaints
 * the grid, calls `onPick` so the caller can apply it at once, and
 * writes settings, which redraws every open view.
 */
export function renderBackgroundPicker(
  parent: HTMLElement,
  plugin: HomeCardsPlugin,
  onPick?: () => void
): BackgroundPicker {
  const grid = parent.createDiv({
    cls: "hc-swatches",
    attr: { role: "radiogroup", "aria-label": "Background" },
  });

  const items = BACKGROUNDS.map((bg) => {
    const item = grid.createEl("button", { cls: "hc-swatch-item", attr: { role: "radio" } });
    const face = item.createDiv({ cls: "hc-swatch" });
    if (bg.id !== "plain") face.dataset.pattern = bg.id;
    item.createDiv({ cls: "hc-swatch-label", text: bg.label });
    item.addEventListener("click", () => {
      if (plugin.settings.background === bg.id) return;
      plugin.settings.background = bg.id;
      paint();
      onPick?.();
      void plugin.commit();
    });
    return { id: bg.id, item };
  });

  const paint = () => {
    for (const { id, item } of items) {
      const on = plugin.settings.background === id;
      item.toggleClass("is-selected", on);
      item.setAttr("aria-checked", String(on));
    }
  };
  paint();
  return { paint };
}
