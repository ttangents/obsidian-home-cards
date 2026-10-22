/**
 * A note's page: the notes one note is connected to, in sections. Without
 * Relate it has two, the note's links and its backlinks. With Relate, each
 * relationship the note has comes first, in a section of its own, then the
 * links no relationship covers, then the notes closest in meaning when
 * search by meaning is on.
 *
 * The sections are made each time the page is drawn, never stored, so they
 * follow the note as its links change.
 *
 * Pure: reads only what it is given.
 */

import { blankSection, LIMITS, type SectionConfig } from "../settings/schema";
import type { RelateView } from "./relate";
import type { LinkGraph } from "./vault";

const CARDS = 8;

export function noteSections(path: string, relate: RelateView | null, links: LinkGraph): SectionConfig[] {
  // Each section shows all its notes up front, up to the section limit, so
  // none is left in See more for a later section to take.
  const size = (n: number) => Math.min(LIMITS.count.max, Math.max(CARDS, n));
  const sizes = new Map<string, number>();
  for (const c of relate?.connections(path) ?? []) sizes.set(c.prop, (sizes.get(c.prop) ?? 0) + 1);
  const sections = [...sizes].map(([prop, n]) =>
    blankSection({
      id: `note-rel-${prop}`,
      kind: "relationship",
      note: path,
      relation: prop,
      count: size(n),
    })
  );
  const props = [...sizes.keys()];
  // With relationships above them, these hold only the links left over.
  const rest = props.length > 0;
  sections.push(
    blankSection({ id: "note-out", kind: "links-out", note: path, count: size(links.out.get(path)?.size ?? 0), title: rest ? "Other links in this note" : "" }),
    blankSection({ id: "note-in", kind: "links-in", note: path, count: size(links.in.get(path)?.size ?? 0), title: rest ? "Other backlinks" : "" })
  );
  if (relate?.meaningReady()) sections.push(blankSection({ id: "note-similar", kind: "similar", note: path, count: CARDS }));
  return sections;
}

/** How many distinct notes the note is connected to, by links or relationships. */
export function neighbourCount(path: string, links: LinkGraph, relate: RelateView | null): number {
  const all = new Set([...(links.out.get(path) ?? []), ...(links.in.get(path) ?? [])]);
  for (const c of relate?.connections(path) ?? []) all.add(c.path);
  all.delete(path);
  return all.size;
}
