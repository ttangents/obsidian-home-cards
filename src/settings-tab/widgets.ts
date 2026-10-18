/**
 * Small helpers shared by the settings tab and the editors it opens.
 */

import type { DropdownComponent } from "obsidian";
import { describeCondition } from "../compose/conditions";
import { labelOf, SECTION_KINDS, sectionTitle, type SectionConfig } from "../settings/schema";

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

/** The second line of a section's row: its source, its first condition and card count. */
export function sectionSummary(cfg: SectionConfig): string {
  const cards = `${cfg.count} ${cfg.count === 1 ? "card" : "cards"}`;
  const source = labelOf(SECTION_KINDS, cfg.kind);
  const bits = cfg.title.trim() && source !== sectionTitle(cfg) ? [source] : [];
  const conditions = cfg.conditions.filter((c) => c.property.trim());
  if (conditions.length) {
    const more = conditions.length > 1 ? ` and ${conditions.length - 1} more` : "";
    bits.push(`where ${describeCondition(conditions[0])}${more}`);
  }
  bits.push(cards);
  return bits.join(" · ");
}
