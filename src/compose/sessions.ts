/**
 * Work sessions, derived from opens: a run of opens with no gap longer
 * than 45 minutes is one session. Nothing is stored; sessions are worked
 * out from the activity log whenever a section asks.
 *
 * The rule is deliberately plain. It claims no more than it knows: these
 * notes were open close together in time, and nothing about why.
 *
 * Pure: no App, no I/O.
 */

import type { OpenEvent } from "./activity";

export const SESSION_GAP_MS = 45 * 60_000;

export interface Session {
  /** Epoch milliseconds of the first and last open. */
  start: number;
  end: number;
  /** Notes opened, the latest first, each once, with its latest open in the session. */
  notes: OpenEvent[];
}

/** Sessions from opens given newest first; the latest session first. */
export function sessionsFrom(events: readonly OpenEvent[], gap = SESSION_GAP_MS): Session[] {
  const out: Session[] = [];
  let current: (Session & { seen: Set<string> }) | null = null;
  for (const e of events) {
    if (!current || current.start - e.at > gap) {
      current = { start: e.at, end: e.at, notes: [], seen: new Set() };
      out.push(current);
    }
    current.start = Math.min(current.start, e.at);
    if (!current.seen.has(e.path)) {
      current.seen.add(e.path);
      current.notes.push({ path: e.path, at: e.at });
    }
  }
  return out.map(({ start, end, notes }) => ({ start, end, notes }));
}
