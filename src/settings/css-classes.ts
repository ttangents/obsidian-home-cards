/**
 * Custom CSS classes a page or a section may carry, for CSS snippets and
 * themes to style it (see docs/STYLING.md). A class is a name and nothing
 * else: Home Cards never takes a style, a selector or markup from these
 * fields.
 *
 * A field holds up to three class names separated by spaces or commas.
 * A name must be a valid CSS identifier of at most 40 characters, and
 * must not start with `hc-`, which Home Cards keeps for its own classes,
 * nor be one of the state classes Obsidian and Home Cards toggle. Names
 * that break a rule drop out; the rest keep their order.
 *
 * Pure: no App, no DOM.
 */

/** Names a field may hold, at most. */
export const MAX_CSS_CLASSES = 3;
const MAX_LENGTH = 40;
const IDENTIFIER = /^-?[A-Za-z_][A-Za-z0-9_-]*$/;
/** Classes Home Cards or Obsidian set on these elements, which a custom class must not imitate. */
const RESERVED = /^(hc-|home-cards$|is-|mod-|theme-)/i;

/** The valid class names in a field, in order, without repeats. */
export function cssClassList(raw: string): string[] {
  const out: string[] = [];
  for (const name of raw.split(/[\s,]+/)) {
    if (!name || name.length > MAX_LENGTH || !IDENTIFIER.test(name) || RESERVED.test(name)) continue;
    if (!out.includes(name)) out.push(name);
    if (out.length === MAX_CSS_CLASSES) break;
  }
  return out;
}

/** The field as stored: its valid names, separated by single spaces. */
export function normalizeCssClass(raw: unknown): string {
  return typeof raw === "string" ? cssClassList(raw).join(" ") : "";
}
