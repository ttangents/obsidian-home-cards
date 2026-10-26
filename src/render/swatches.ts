/**
 * The background picker: one swatch per built-in background, then one
 * per image the user added, used by both the settings tab and the home
 * page's header picker, so the two offer the same choices and write the
 * same setting.
 *
 * Each swatch paints with the custom properties the page itself uses, so
 * a preview cannot drift from the real background, and the theme's mode
 * selects the light or dark tile for the swatch exactly as it does for
 * the page.
 */

import { BACKGROUNDS } from "../settings/schema";
import type { SettingsAccess } from "../settings/store";
import { backgroundProps, patternProps, type BackgroundStore } from "./backgrounds";

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
  store: SettingsAccess,
  backgrounds: BackgroundStore,
  onPick?: () => void
): BackgroundPicker {
  const grid = parent.createDiv({
    cls: "hc-swatches",
    attr: { role: "radiogroup", "aria-label": "Background" },
  });

  const choices = [
    ...BACKGROUNDS.map((bg) => ({ id: bg.id, label: bg.label, custom: null })),
    ...store.settings.customBackgrounds.map((bg) => ({ id: bg.id, label: bg.label, custom: bg })),
  ];
  const items = choices.map((bg) => {
    const item = grid.createEl("button", { cls: "hc-swatch-item", attr: { role: "radio" } });
    const face = item.createDiv({ cls: "hc-swatch" });
    if (bg.custom) {
      face.dataset.pattern = "custom";
      face.dataset.fit = bg.custom.fit;
      face.setCssProps(backgroundProps(backgrounds.url(bg.custom), bg.custom));
    } else if (bg.id !== "plain") {
      face.dataset.pattern = bg.id;
      face.setCssProps(patternProps(bg.id));
    }
    item.createDiv({ cls: "hc-swatch-label", text: bg.label });
    item.addEventListener("click", () => {
      if (store.settings.background === bg.id) return;
      store.settings.background = bg.id;
      paint();
      onPick?.();
      void store.commit();
    });
    return { id: bg.id, item };
  });

  const paint = () => {
    for (const { id, item } of items) {
      const on = store.settings.background === id;
      item.toggleClass("is-selected", on);
      item.setAttr("aria-checked", String(on));
    }
  };
  paint();
  return { paint };
}
