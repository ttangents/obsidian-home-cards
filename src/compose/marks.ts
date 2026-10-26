/**
 * The rules for Home Cards' marks on notes: pins, snoozes and notes that
 * Rediscover passes over. See NoteMarks in settings/schema.ts for why
 * these live in Home Cards and not in the notes.
 *
 * A snoozed note leaves every section but Pinned until the morning of its
 * return date. Pinning a note ends its snooze, since the two ask for
 * opposite things. A quiet note leaves only Rediscover.
 *
 * Pure: the functions that change marks mutate the object they are given
 * and report whether anything changed, so the caller knows to save.
 */

import { isWithin, reparent } from "../settings/folders";
import { LIMITS, type NoteMarks } from "../settings/schema";

/** A local date as YYYY-MM-DD. */
export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The local date `days` days after `now`. */
export function dateAfter(now: Date, days: number): string {
  return localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
}

export function isPinned(marks: NoteMarks, path: string): boolean {
  return marks.pinned.includes(path);
}

/** Snoozed until a later day than today. */
export function isSnoozed(marks: NoteMarks, path: string, now: Date): boolean {
  const until = marks.snoozed[path];
  return until !== undefined && until > localDate(now);
}

export function isQuiet(marks: NoteMarks, path: string): boolean {
  return marks.quiet.includes(path);
}

/** Pin or unpin. A new pin goes first, and ends any snooze. */
export function togglePin(marks: NoteMarks, path: string): boolean {
  const at = marks.pinned.indexOf(path);
  if (at >= 0) {
    marks.pinned.splice(at, 1);
  } else {
    marks.pinned.unshift(path);
    marks.pinned.length = Math.min(marks.pinned.length, LIMITS.pinned.max);
    delete marks.snoozed[path];
  }
  return true;
}

/** Hide a note from every section but Pinned for `days` days. */
export function snooze(marks: NoteMarks, path: string, now: Date, days: number): boolean {
  marks.snoozed[path] = dateAfter(now, days);
  const paths = Object.keys(marks.snoozed);
  // Past the cap, the snoozes that end soonest go first.
  if (paths.length > LIMITS.snoozed.max) {
    paths.sort((a, b) => marks.snoozed[a].localeCompare(marks.snoozed[b]));
    for (const p of paths.slice(0, paths.length - LIMITS.snoozed.max)) delete marks.snoozed[p];
  }
  return true;
}

/** Pass the note over in Rediscover, or stop doing so. */
export function toggleQuiet(marks: NoteMarks, path: string): boolean {
  const at = marks.quiet.indexOf(path);
  if (at >= 0) marks.quiet.splice(at, 1);
  else {
    marks.quiet.unshift(path);
    marks.quiet.length = Math.min(marks.quiet.length, LIMITS.quiet.max);
  }
  return true;
}

/** Drop the snoozes that have ended. */
export function pruneSnoozes(marks: NoteMarks, now: Date): boolean {
  const today = localDate(now);
  let changed = false;
  for (const [path, until] of Object.entries(marks.snoozed)) {
    if (until <= today) {
      delete marks.snoozed[path];
      changed = true;
    }
  }
  return changed;
}

/** Follow a rename of a note or a folder. */
export function renameMarks(marks: NoteMarks, from: string, to: string): boolean {
  let changed = false;
  const list = (paths: string[]) => {
    for (let i = 0; i < paths.length; i++) {
      const next = reparent(paths[i], from, to);
      if (next !== paths[i]) {
        paths[i] = next;
        changed = true;
      }
    }
  };
  list(marks.pinned);
  list(marks.quiet);
  for (const [path, until] of Object.entries(marks.snoozed)) {
    const next = reparent(path, from, to);
    if (next === path) continue;
    delete marks.snoozed[path];
    marks.snoozed[next] = until;
    changed = true;
  }
  return changed;
}

/** Forget a deleted note, or every note under a deleted folder. */
export function forgetMarks(marks: NoteMarks, path: string): boolean {
  const gone = (p: string) => isWithin(p, path);
  let changed = false;
  for (const paths of [marks.pinned, marks.quiet]) {
    for (let i = paths.length - 1; i >= 0; i--) {
      if (gone(paths[i])) {
        paths.splice(i, 1);
        changed = true;
      }
    }
  }
  for (const p of Object.keys(marks.snoozed)) {
    if (gone(p)) {
      delete marks.snoozed[p];
      changed = true;
    }
  }
  return changed;
}
