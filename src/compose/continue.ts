/**
 * Continue working: the notes of the latest work session, then the notes
 * edited while it ran, then the session before it. Sessions come from the
 * activity log (see sessions.ts); each card says how it belongs.
 *
 * Pure: reads only the vault snapshot it is given.
 */

import type { TFile } from "obsidian";
import { relativeTime } from "./projection";
import type { Ranked } from "./rank";
import { SESSION_GAP_MS, sessionsFrom } from "./sessions";
import type { VaultSnapshot } from "./vault";

export function continueWorking(vault: VaultSnapshot, pool: readonly TFile[]): Ranked[] {
  const now = vault.now;
  const byPath = new Map(pool.map((f) => [f.path, f]));
  const [latest, earlier] = sessionsFrom(vault.activity.events());
  if (!latest) return [];
  const out: Ranked[] = [];
  const seen = new Set<string>();
  const push = (file: TFile | undefined, lead: string) => {
    if (!file || seen.has(file.path)) return;
    seen.add(file.path);
    out.push({ file, lead });
  };

  latest.notes.forEach(({ path, at }, i) =>
    push(byPath.get(path), i === 0 ? `Opened ${relativeTime(at, now)}` : "Opened in the same session")
  );
  // Edits during the session, or in the quiet stretch after its last open.
  const until = latest.end + SESSION_GAP_MS;
  pool
    .filter((f) => f.stat.mtime >= latest.start && f.stat.mtime <= until)
    .sort((a, b) => b.stat.mtime - a.stat.mtime)
    .forEach((f) => push(f, "Edited during that session"));
  if (earlier) {
    const when = relativeTime(earlier.end, now);
    for (const { path } of earlier.notes) push(byPath.get(path), `From a session ${when}`);
  }
  return out;
}
