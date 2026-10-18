/**
 * Note templates: what a new note must start with to belong where it was
 * created.
 *
 * A template holds only facts that a page or section states as an exact
 * value: a folder, a tag, a property equal to a value. A condition such as
 * "rating at least 4" or "modified this week" names no single value, so it
 * contributes nothing, and a template never invents one. When two sources
 * state different values for the same fact, no template exists, because no
 * single note could satisfy both.
 *
 * Pure: the caller applies a template through Obsidian's own file and
 * frontmatter APIs (see render/actions.ts), never by writing YAML text.
 */

import type { PageScope } from "../settings/schema";

export type TemplateValue = string | number | boolean;

export interface NoteTemplate {
  /** Folder for the note; "" leaves it to Obsidian's default location. */
  folder: string;
  /** Tags to add, without `#`. */
  tags: string[];
  /** Properties to set, by key. */
  properties: Record<string, TemplateValue>;
}

export const EMPTY_TEMPLATE: Readonly<NoteTemplate> = Object.freeze({ folder: "", tags: [], properties: {} });

/** Whether a template sets anything beyond the default location. */
export function hasFacts(t: NoteTemplate): boolean {
  return t.tags.length > 0 || Object.keys(t.properties).length > 0;
}

/** A single literal tag: no wildcard, no list, no spaces. */
export function literalTag(raw: string): string | null {
  const tag = raw.trim().replace(/^#/, "");
  return /^[^\s,*#]+$/.test(tag) ? tag : null;
}

/** A property key a frontmatter writer can take as is. */
export function literalKey(raw: string): string | null {
  const key = raw.trim();
  return key && !/[\n:]/.test(key) ? key : null;
}

/**
 * A typed value from text a user typed: numbers and true or false become
 * the YAML types a property editor would store; anything else stays text.
 */
export function typedValue(raw: string): TemplateValue {
  const text = raw.trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === "true";
  return text;
}

/** The template a page's scope implies. */
export function templateForScope(scope: PageScope): NoteTemplate {
  const t: NoteTemplate = { folder: "", tags: [], properties: {} };
  switch (scope.kind) {
    case "folder":
      t.folder = scope.folder;
      break;
    case "tag": {
      const tag = literalTag(scope.tag);
      if (tag) t.tags.push(tag);
      break;
    }
    case "property": {
      const key = literalKey(scope.propertyKey);
      if (key && scope.propertyValue.trim()) t.properties[key] = typedValue(scope.propertyValue);
      break;
    }
    default:
      break;
  }
  return t;
}

/**
 * Combine templates, the later adding to the earlier. Null when two state
 * different folders or different values for one property.
 */
export function mergeTemplates(...parts: readonly NoteTemplate[]): NoteTemplate | null {
  const out: NoteTemplate = { folder: "", tags: [], properties: {} };
  for (const part of parts) {
    if (part.folder) {
      if (out.folder && out.folder !== part.folder) return null;
      out.folder = part.folder;
    }
    for (const tag of part.tags) if (!out.tags.includes(tag)) out.tags.push(tag);
    for (const [key, value] of Object.entries(part.properties)) {
      if (key in out.properties && out.properties[key] !== value) return null;
      out.properties[key] = value;
    }
  }
  return out;
}
