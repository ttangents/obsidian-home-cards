/**
 * Small helpers shared by the settings tab and the editors it opens.
 */

import { Setting, type DropdownComponent } from "obsidian";
import { describeCondition } from "../compose/conditions";
import { cssClassList, MAX_CSS_CLASSES } from "../settings/css-classes";
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
  if (cfg.kind === "pinned") bits.push("always first, hidden without pins");
  return bits.join(" · ");
}

/**
 * The CSS class field of a page or a section. It stores what is typed;
 * the normalizer and the views keep only valid names. The description
 * says which names it will use, so a typo shows at once.
 */
export function cssClassSetting(el: HTMLElement, what: "page" | "section", value: string, save: (value: string) => void): void {
  const intro = `Up to ${MAX_CSS_CLASSES} class names for CSS snippets and themes to style this ${what} by.`;
  const describe = (raw: string) => {
    const names = cssClassList(raw);
    if (!raw.trim()) return `${intro} Names starting with hc- are kept for Home Cards.`;
    return names.length ? `${intro} Applies: ${names.join(", ")}.` : `${intro} None of these is a valid class name.`;
  };
  const setting = new Setting(el).setName("CSS class").setDesc(describe(value));
  setting.addText((t) =>
    t
      .setPlaceholder(what === "page" ? "reading-room" : "featured")
      .setValue(value)
      .onChange((raw) => {
        setting.setDesc(describe(raw));
        save(raw);
      })
  );
}
