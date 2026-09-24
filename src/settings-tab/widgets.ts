/**
 * Small builders shared by the settings panes. Each reproduces Obsidian's
 * own markup, so the active theme styles these rows exactly as it styles
 * every other plugin's.
 */

import type { DropdownComponent } from "obsidian";
import { Setting } from "obsidian";

interface Choice {
  readonly id: string;
  readonly label: string;
}

/**
 * Obsidian's grouped-settings markup: an optional heading row, then a
 * `.setting-items` container the caller fills with rows. Themes draw the
 * container as one card with hairline dividers. This is the DOM that
 * `SettingGroup` (1.11+) produces, built by hand so the plugin keeps its
 * 1.10 floor, which Bases sets.
 */
export function settingGroup(parent: HTMLElement, heading?: string, cls?: string): HTMLElement {
  const group = parent.createDiv({ cls: "setting-group" });
  if (cls) group.addClass(cls);
  if (heading) new Setting(group).setName(heading).setHeading();
  return group.createDiv({ cls: "setting-items" });
}

/** A muted sentence of guidance above a pane or inside a group. */
export function hint(parent: HTMLElement, text: string): void {
  parent.createEl("p", { cls: "hc-hint", text });
}

/** Fill a dropdown from a schema registry, in registry order. */
export function addChoices(dropdown: DropdownComponent, registry: readonly Choice[]): DropdownComponent {
  for (const c of registry) dropdown.addOption(c.id, c.label);
  return dropdown;
}
