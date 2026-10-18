/**
 * Card projection: how a section's chosen fields read on a card's footer,
 * e.g. "Active · Leslie · Due Friday" or "David Deutsch · Rating 5".
 *
 * Each value reads by its kind. Text and lists show their values, with a
 * link shown by its alias or note name; a date shows its field's name and
 * a day in words; a number shows its field's name and the number; a true
 * checkbox shows its field's name, and a false one shows nothing. The
 * rules depend on the value, never on what a property happens to be
 * called, so a property named "rating" gets no stars it did not ask for.
 *
 * Pure: no App, no I/O.
 */

import type { CachedMetadata, TFile } from "obsidian";
import { fieldLabel, fieldValue, isEmpty, startOfDay } from "./conditions";
import { parseDateLike } from "./values";

/** Members a list shows before it counts the rest. */
const LIST_SHOWN = 3;

/** A value as card text: a link as its alias or its note's name. */
export function displayText(value: unknown): string {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value !== "string") return "";
  const text = value.trim();
  const link = /^!?\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]$/.exec(text);
  if (link) {
    if (link[2]) return link[2].trim();
    const target = link[1].split("#")[0];
    return target.slice(target.lastIndexOf("/") + 1).replace(/\.md$/, "");
  }
  return text;
}

/**
 * A day in words, from the reader's today: "today", "tomorrow",
 * "yesterday", a weekday within the coming week, "3 days ago" within the
 * past one, and a short date beyond that, with the year when it differs.
 */
export function relativeDay(d: Date, now: Date): string {
  const days = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1 && days < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  if (days < -1 && days > -7) return `${-days} days ago`;
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

/**
 * A moment in words: minutes and hours within the day, then days as
 * relativeDay reads them. For "Opened 43 minutes ago".
 */
export function relativeTime(at: number, now: Date): string {
  const minutes = Math.floor((now.getTime() - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && startOfDay(new Date(at)) === startOfDay(now)) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  return relativeDay(new Date(at), now);
}

/** A span in months or years, for "untouched for 8 months". */
export function spanSince(at: number, now: Date): string {
  const months = Math.floor((now.getTime() - at) / (30.44 * 86_400_000));
  if (months < 1) return "less than a month";
  if (months < 24) return `${months} ${months === 1 ? "month" : "months"}`;
  return `${Math.floor(months / 12)} years`;
}

const capitalized = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  return typeof value === "string" ? parseDateLike(value) : null;
}

/** One field as footer text; "" when it has nothing to show. */
export function formatField(field: string, value: unknown, now: Date): string {
  if (isEmpty(value)) return "";
  const label = capitalized(fieldLabel(field));
  if (Array.isArray(value)) {
    const items = value.map(displayText).filter(Boolean);
    const shown = items.slice(0, LIST_SHOWN).join(", ");
    return items.length > LIST_SHOWN ? `${shown} +${items.length - LIST_SHOWN}` : shown;
  }
  const date = asDate(value);
  if (date) return `${label} ${relativeDay(date, now)}`;
  if (typeof value === "number") return `${label} ${value}`;
  if (typeof value === "boolean") return value ? label : "";
  return displayText(value);
}

/** The section's fields for one note, in order, skipping the empty ones. */
export function projectFields(
  file: TFile,
  cache: CachedMetadata | null,
  fields: readonly string[],
  now: Date
): string[] {
  return fields.map((field) => formatField(field, fieldValue(file, cache, field), now)).filter(Boolean);
}
