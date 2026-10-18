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

import { normalizeFolderPath } from "../settings/folders";
import type { PageScope, SectionConfig, SectionKind } from "../settings/schema";
import { compileCondition, isFileField, statedValue } from "./conditions";
import { splitList } from "./values";

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

/**
 * Sources that select by ranking alone, so any note can belong. The rest
 * select by facts a template cannot give a note: having been opened,
 * being old, being pinned, being linked to recent work.
 */
const RANKING_ONLY: ReadonlySet<SectionKind> = new Set(["recent-created", "recent-modified", "most-linked", "least-linked"]);

export interface SectionWrite {
  /** The facts the section states as exact values. */
  template: NoteTemplate;
  /**
   * True when a note given the template, and nothing else, belongs in the
   * section: every rule the section selects by is either stated in the
   * template or met by any new note.
   */
  complete: boolean;
}

/**
 * The template a section implies, and whether it is complete. A section
 * can take a new note (its + button) or a moved card (a drop, or Move to
 * in the card menu) only when it is complete and states at least one tag
 * or property: then the change it would make can be named exactly.
 */
export function sectionWrite(cfg: SectionConfig, now: Date): SectionWrite {
  const t: NoteTemplate = { folder: "", tags: [], properties: {} };
  let complete = true;

  if (cfg.kind === "property") {
    const key = literalKey(cfg.propertyKey);
    if (key && cfg.propertyValue.trim()) t.properties[key] = typedValue(cfg.propertyValue);
    else complete = false;
  } else if (cfg.kind === "tag") {
    const tag = literalTag(cfg.tag);
    if (tag) t.tags.push(tag);
    else complete = false;
  } else if (!RANKING_ONLY.has(cfg.kind)) {
    complete = false;
  }

  // Include-filters: one literal entry states a fact; a list is a choice.
  const tags = splitList(cfg.filterTags);
  if (tags.length === 1 && literalTag(tags[0])) t.tags.push(literalTag(tags[0]) ?? "");
  else if (tags.length) complete = false;

  const props = splitList(cfg.filterProps);
  const rule = props.length === 1 ? /^([^=]+)=(.+)$/.exec(props[0]) : null;
  const ruleKey = rule ? literalKey(rule[1]) : null;
  if (rule && ruleKey) t.properties[ruleKey] = typedValue(rule[2]);
  else if (props.length) complete = false;

  const folders = splitList(cfg.filterFolders);
  if (folders.length === 1 && folders[0].includes("/") && !folders[0].includes("*")) {
    t.folder = normalizeFolderPath(folders[0]);
  } else if (folders.length) complete = false;

  // Conditions: an exact value is stated; any other must already hold for
  // a new note carrying the stated values, created now.
  for (const cond of cfg.conditions) {
    if (!cond.property.trim()) continue;
    const stated = statedValue(cond);
    if (stated) {
      const key = literalKey(stated.key);
      const value = typedValue(stated.value);
      if (!key || (key in t.properties && t.properties[key] !== value)) return { template: t, complete: false };
      t.properties[key] = value;
      continue;
    }
    const test = compileCondition(cond, now);
    if (!test) continue;
    const field = cond.property.trim();
    const value = isFileField(field) ? now : t.properties[field];
    if (!test(value)) complete = false;
  }
  return { template: t, complete };
}

/** Whether a section can take a moved card: complete, stating a fact, and not a folder move. */
export function acceptsMoves(write: SectionWrite): boolean {
  return write.complete && hasFacts(write.template) && !write.template.folder;
}

/** What applying a template does, in words: "Set status to waiting and add #reading". */
export function describeTemplate(t: NoteTemplate): string {
  const sets = Object.entries(t.properties).map(([k, v]) => `${k} to ${String(v)}`);
  const parts: string[] = [];
  if (sets.length) parts.push(`set ${sets.join(", ")}`);
  if (t.tags.length) parts.push(`add ${t.tags.map((tag) => `#${tag}`).join(", ")}`);
  if (t.folder) parts.push(`file in ${t.folder}`);
  const text = parts.join(" and ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
