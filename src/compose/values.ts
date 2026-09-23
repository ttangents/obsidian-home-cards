/**
 * Frontmatter coercion. YAML hands back strings, numbers, booleans,
 * lists, nested objects and nulls; every consumer in the compose layer
 * wants strings. These helpers are the one place that decision lives.
 */

import type { CachedMetadata } from "obsidian";

export function frontmatterValue(cache: CachedMetadata | null, key: string): unknown {
  if (!cache?.frontmatter || !key) return undefined;
  return cache.frontmatter[key];
}

/**
 * Scalars become one-element lists; lists keep their scalar members.
 * Objects and nulls are dropped: a nested map is not a sortable value
 * and `String({})` would put "[object Object]" on a card.
 */
export function asStringList(value: unknown): string[] {
  const one = (v: unknown): string | null => {
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return null;
  };
  const list = Array.isArray(value) ? value : [value];
  return list.map(one).filter((v): v is string => v !== null);
}

export function firstValue(value: unknown): string {
  return asStringList(value)[0] ?? "";
}

/**
 * Parse ISO-shaped dates only. A date-only string is built in local time:
 * `new Date("2026-08-03")` is UTC midnight, which renders as 2 August
 * anywhere west of Greenwich. Bare numbers are rejected outright, or a
 * property holding `2024` would sort and render as a date.
 */
export function parseDateLike(raw: string): Date | null {
  const s = raw.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    const d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (!/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Comma-separated settings field to trimmed, non-empty entries. */
export function splitList(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Remember the last input and its result. Settings fields parsed on every
 * card change only when the user edits them, so one slot is a perfect
 * cache and, unlike a keyed map, cannot grow with every string typed.
 */
export function memoLast<I, O>(fn: (input: I) => O): (input: I) => O {
  let lastIn: I | undefined;
  let lastOut: O | undefined;
  let primed = false;
  return (input) => {
    if (!primed || input !== lastIn) {
      lastIn = input;
      lastOut = fn(input);
      primed = true;
    }
    return lastOut as O;
  };
}
