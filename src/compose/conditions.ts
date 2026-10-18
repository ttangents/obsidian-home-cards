/**
 * Typed conditions: the selection primitive behind sections such as "Due
 * today", "Overdue", "Captured this week" or "Highly rated".
 *
 * A condition tests one property, or one file field, with one operator.
 * Obsidian publishes no API for property types, so the type of a value is
 * read from the value: a list, a number, true or false, an ISO date, or
 * text. The editor infers a property's type the same way, across the
 * vault, to offer only the operators that mean something for it.
 *
 * Evaluation is deterministic. Dates compare in local calendar days from
 * the compose's `now`, so "today" means the reader's today; "in the next
 * 7 days" runs from today through the seventh day after it. A condition
 * that cannot be read (no property, a number that is not one) tests
 * nothing, and the section ignores it, as it ignores a blank filter.
 *
 * Pure: no App, no I/O.
 */

import type { CachedMetadata, TFile } from "obsidian";
import { CONDITION_OPS, FILE_FIELDS, type Condition, type ValueType } from "../settings/schema";
import { parseDateLike } from "./values";

// ---------------------------------------------------------------- reading

/** A frontmatter value by key, matched without regard to case, as Bases matches keys. */
export function propertyValue(cache: CachedMetadata | null, key: string): unknown {
  const fm = cache?.frontmatter;
  if (!fm || !key) return undefined;
  if (key in fm) return fm[key];
  const lower = key.toLowerCase();
  const match = Object.keys(fm).find((k) => k.toLowerCase() === lower);
  return match === undefined ? undefined : fm[match];
}

/** A field's value: a file field as a Date, a property as stored. */
export function fieldValue(file: TFile, cache: CachedMetadata | null, field: string): unknown {
  if (field === "file.ctime") return new Date(file.stat.ctime);
  if (field === "file.mtime") return new Date(file.stat.mtime);
  return propertyValue(cache, field);
}

export function isFileField(field: string): boolean {
  return FILE_FIELDS.some((f) => f.id === field);
}

/** Null, "" and [] are no value. */
export function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

/** The type a single value reads as; null for no value or a nested map. */
export function valueType(value: unknown): ValueType | null {
  if (isEmpty(value)) return null;
  if (Array.isArray(value)) return "list";
  if (value instanceof Date) return "date";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return parseDateLike(value) ? "date" : "text";
  return null;
}

/**
 * A property's type across the notes that hold it: the most common type
 * among their values, with text winning ties, since text is the type
 * every value can be read as.
 */
export function inferType(values: readonly unknown[]): ValueType {
  const counts = new Map<ValueType, number>();
  for (const v of values) {
    const t = valueType(v);
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best: ValueType = "text";
  let most = 0;
  for (const [t, n] of counts) {
    if (n > most || (n === most && t === "text")) {
      best = t;
      most = n;
    }
  }
  return best;
}

/** The operators that mean something for a type. */
export function opsFor(type: ValueType): (typeof CONDITION_OPS)[number][] {
  return CONDITION_OPS.filter((op) => (op.types as readonly ValueType[]).includes(type));
}

/**
 * Text as a condition compares it: trimmed, lowercased, with a link's
 * brackets and alias and a tag's `#` removed, so `[[Leslie Joseph|Les]]`
 * is "leslie joseph" and `#Active` is "active".
 */
export function normalText(value: unknown): string {
  let text = typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : "";
  text = text.trim();
  const link = /^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/.exec(text);
  if (link) text = link[1];
  return text.replace(/^#/, "").trim().toLowerCase();
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(value)) return Number(value);
  return null;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") return parseDateLike(value);
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "yes") return true;
  if (v === "false" || v === "no") return false;
  return null;
}

/** Midnight at the start of `d`'s local day. */
export function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Midnight `days` local days after the start of `d`'s day; safe across clock changes. */
function dayStart(d: Date, days: number): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

// ------------------------------------------------------------- evaluation

type Test = (value: unknown) => boolean;

/** Lists match when any member does. */
const anyMember = (test: Test): Test => (value) =>
  Array.isArray(value) ? value.some((v) => !isEmpty(v) && test(v)) : !isEmpty(value) && test(value);

/** Equality, read by the kind of value the condition holds. */
function equalsTest(raw: string): Test | null {
  const want = raw.trim();
  if (!want) return null;
  const num = asNumber(want);
  const bool = asBoolean(want);
  const date = parseDateLike(want);
  const text = normalText(want);
  return (v) => {
    if (num !== null && asNumber(v) !== null) return asNumber(v) === num;
    if (bool !== null && typeof v === "boolean") return v === bool;
    if (date !== null) {
      const d = asDate(v);
      if (d) return startOfDay(d) === startOfDay(date);
    }
    return normalText(v) === text;
  };
}

function dayCount(raw: string): number | null {
  const n = asNumber(raw);
  return n !== null && n >= 0 && Number.isInteger(n) ? n : null;
}

/** One condition as a test of a field's value; null when it tests nothing. */
export function compileCondition(cond: Condition, now: Date): Test | null {
  if (!cond.property.trim()) return null;
  const today = startOfDay(now);
  const date = (inRange: (t: number) => boolean): Test =>
    anyMember((v) => {
      const d = asDate(v);
      return d !== null && inRange(d.getTime());
    });
  const number = (compare: (n: number, want: number) => boolean): Test | null => {
    const want = asNumber(cond.value);
    if (want === null) return null;
    return anyMember((v) => {
      const n = asNumber(v);
      return n !== null && compare(n, want);
    });
  };
  const days = dayCount(cond.value);

  switch (cond.op) {
    case "exists":
      return (v) => !isEmpty(v);
    case "missing":
      return (v) => isEmpty(v);
    case "is": {
      const eq = equalsTest(cond.value);
      return eq ? anyMember(eq) : null;
    }
    case "is-not": {
      // A note without the property is not equal to the value.
      const eq = equalsTest(cond.value);
      return eq ? (v) => !anyMember(eq)(v) : null;
    }
    case "gt":
      return number((n, w) => n > w);
    case "gte":
      return number((n, w) => n >= w);
    case "lt":
      return number((n, w) => n < w);
    case "lte":
      return number((n, w) => n <= w);
    case "today":
      return date((t) => t >= today && t < dayStart(now, 1));
    case "before-today":
      return date((t) => t < today);
    case "after-today":
      return date((t) => t >= dayStart(now, 1));
    case "next-days":
      return days === null ? null : date((t) => t >= today && t < dayStart(now, days + 1));
    case "last-days":
      return days === null ? null : date((t) => t >= dayStart(now, -days) && t < dayStart(now, 1));
    case "older-days":
      return days === null ? null : date((t) => t < dayStart(now, -days));
    default:
      return null;
  }
}

/**
 * Every readable condition as one predicate a note must meet in full;
 * null when none of them tests anything.
 */
export function compileConditions(
  conditions: readonly Condition[],
  now: Date
): ((file: TFile, cache: CachedMetadata | null) => boolean) | null {
  const tests = conditions.flatMap((cond) => {
    const test = compileCondition(cond, now);
    return test ? [{ field: cond.property.trim(), test }] : [];
  });
  if (!tests.length) return null;
  return (file, cache) => tests.every(({ field, test }) => test(fieldValue(file, cache, field)));
}

// ------------------------------------------------------------ description

/** The field's name in words: a file field's label, else the key. */
export function fieldLabel(field: string): string {
  return FILE_FIELDS.find((f) => f.id === field)?.label.toLowerCase() ?? field;
}

/** The condition in words, e.g. "due is in the next 7 days". */
export function describeCondition(cond: Condition): string {
  const op = CONDITION_OPS.find((o) => o.id === cond.op);
  if (!op) return "";
  const field = fieldLabel(cond.property.trim()) || "(no property)";
  switch (op.input) {
    case "none":
      return `${field} ${op.label}`;
    case "days": {
      const n = cond.value.trim();
      return op.id === "older-days" ? `${field} ${op.label} ${n} days` : `${field} ${op.label} ${n} ${n === "1" ? "day" : "days"}`;
    }
    default:
      return `${field} ${op.label} ${cond.value.trim()}`;
  }
}

/**
 * The exact value a condition states, when it states one: "status is
 * active" states status = active; "rating is at least 4" states nothing.
 * A file field is never stated: a new note sets its own dates.
 */
export function statedValue(cond: Condition): { key: string; value: string } | null {
  const key = cond.property.trim();
  if (cond.op !== "is" || !key || isFileField(key) || !cond.value.trim()) return null;
  return { key, value: cond.value.trim() };
}
