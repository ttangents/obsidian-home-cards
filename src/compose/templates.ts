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
import { compileCondition, isFileField, normalText, statedValue } from "./conditions";
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
  const sets = Object.entries(t.properties).map(([k, v]) => `${k} to ${plainValue(v)}`);
  const parts: string[] = [];
  if (sets.length) parts.push(`set ${sets.join(", ")}`);
  if (t.tags.length) parts.push(`add ${t.tags.map((tag) => `#${tag}`).join(", ")}`);
  if (t.folder) parts.push(`file in ${t.folder}`);
  const text = parts.join(" and ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What giving a property a template's value did. */
export type ValueChange = "set" | "added" | "replaced" | "unchanged";

/** A value as a reader names it: a link's note name without brackets. */
export function plainValue(value: unknown): string {
  const text = String(value);
  return /^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/.exec(text.trim())?.[1] ?? text;
}

/**
 * A property's next value when a template gives it `value`. A list keeps
 * its members and gains the value, because a list names several things at
 * once, such as the projects a note belongs to, and a move must not drop
 * the others. A single value is replaced, which is what moving a card
 * between status columns means. Values compare as conditions compare
 * them, so `[[Q3 Plan]]` and `Q3 Plan` are the same value.
 */
export function mergeValue(existing: unknown, value: TemplateValue, replacing?: TemplateValue): { next: unknown; change: ValueChange } {
  const sameAs = (target: unknown) => (v: unknown) => v === target || (normalText(v) !== "" && normalText(v) === normalText(target));
  const same = sameAs(value);
  if (Array.isArray(existing)) {
    // A card moved from a section that states another value for this
    // property leaves that value behind, so the move is a move.
    const old = replacing === undefined ? null : sameAs(replacing);
    const kept = old ? (existing as unknown[]).filter((v) => !old(v)) : (existing as unknown[]);
    const dropped = kept.length < existing.length;
    if (kept.some(same)) return dropped ? { next: kept, change: "replaced" } : { next: existing, change: "unchanged" };
    return { next: [...kept, value], change: dropped ? "replaced" : "added" };
  }
  if (existing !== undefined && existing !== null && same(existing)) return { next: existing, change: "unchanged" };
  return { next: value, change: "set" };
}

/** What applying a template changed, in words: "Added Q3 Plan to project and set status to waiting". */
export function describeChanges(
  changes: readonly { key: string; value: TemplateValue; change: ValueChange; from?: TemplateValue }[],
  tags: readonly string[]
): string {
  const parts: string[] = [];
  for (const c of changes) {
    const value = plainValue(c.value);
    if (c.change === "added") parts.push(`added ${value} to ${c.key}`);
    else if (c.change === "set") parts.push(`set ${c.key} to ${value}`);
    else if (c.change === "replaced") parts.push(`changed ${c.key} from ${plainValue(c.from ?? "")} to ${value}`);
  }
  if (tags.length) parts.push(`added ${tags.map((t) => `#${t}`).join(", ")}`);
  if (!parts.length) return "";
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A tag as a note names it, compared without its `#` and without regard to case. */
const tagKey = (tag: string) => tag.trim().replace(/^#/, "").toLowerCase();

/**
 * A note's `tags` value as a list, the way Obsidian reads it: a list keeps
 * its entries, numbers among them, and a single value of text holds tags
 * separated by commas or spaces. Empty entries drop out; anything else
 * stays as it was.
 */
function tagEntries(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return value.split(/[\s,]+/).filter(Boolean);
  const list: unknown[] = Array.isArray(value) ? value : [value];
  return list
    .filter((t) => t !== null && t !== undefined && t !== "")
    .map((t) => (typeof t === "number" || typeof t === "boolean" ? String(t) : t));
}

/**
 * The note's tags once `wanted` are added, or null when it already has
 * them all, so the caller leaves the property exactly as it is. Every
 * existing tag stays, numbers written as text; `added` names the tags
 * that were missing.
 */
export function addTags(existing: unknown, wanted: readonly string[]): { next: unknown[]; added: string[] } | null {
  const entries = tagEntries(existing);
  const have = new Set(entries.filter((t): t is string => typeof t === "string").map(tagKey));
  const added: string[] = [];
  for (const tag of wanted) {
    const key = tagKey(tag);
    if (!key || have.has(key)) continue;
    have.add(key);
    added.push(tag);
  }
  return added.length ? { next: [...entries, ...added], added } : null;
}

/**
 * Give a note's frontmatter a template's tags and properties, in place:
 * the body of the callback Obsidian's `processFrontMatter` runs, so the
 * YAML stays Obsidian's to write. Tags join the note's existing tags, and
 * a list property gains the value rather than losing its other members
 * (see `mergeValue`). `from` is the template of the section the card
 * left, when it moved: a value that section stated is replaced rather
 * than kept beside the new one. Returns what changed, in words, or ""
 * when the note already had it.
 */
export function applyToFrontmatter(fm: Record<string, unknown>, template: NoteTemplate, from?: NoteTemplate): string {
  const changes: { key: string; value: TemplateValue; change: ValueChange; from?: TemplateValue }[] = [];
  for (const [key, value] of Object.entries(template.properties)) {
    const old = from?.properties[key];
    const replacing = old !== undefined && old !== value ? old : undefined;
    const { next, change } = mergeValue(fm[key], value, replacing);
    if (change !== "unchanged") fm[key] = next;
    changes.push({ key, value, change, from: replacing });
  }
  const tags = template.tags.length ? addTags(fm.tags, template.tags) : null;
  if (tags) fm.tags = tags.next;
  return describeChanges(changes, tags?.added ?? []);
}
