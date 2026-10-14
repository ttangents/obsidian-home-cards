/**
 * Small helpers shared by the settings tab and the section editor.
 */

import type { DropdownComponent } from "obsidian";

interface Choice {
  readonly id: string;
  readonly label: string;
}

/** A schema registry as dropdown options, in registry order. */
export function choiceOptions(registry: readonly Choice[]): Record<string, string> {
  return Object.fromEntries(registry.map((c) => [c.id, c.label]));
}

/** Fill a dropdown component from a schema registry, in registry order. */
export function addChoices(dropdown: DropdownComponent, registry: readonly Choice[]): DropdownComponent {
  return dropdown.addOptions(choiceOptions(registry));
}
