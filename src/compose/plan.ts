/**
 * What a page shows, decided from a composed page: a line in place of
 * the sections when the page has nothing to show, or the sections to draw
 * with what each one says when empty, what its + button creates, what a
 * card dropped on it becomes, and where its cards can move.
 *
 * The home view draws the plan and decides nothing itself. Pure: the
 * vault facts arrive as functions, so the tests drive it directly.
 */

import type { ResolvedPage } from "../settings/pages";
import { sectionTitle, type SectionConfig, type SectionKind } from "../settings/schema";
import type { ComposedPage, ComposedSection } from "./compose";
import { RELATE_INCOMPATIBLE, type RelateStatus, type RelateView } from "./relate";
import {
  acceptsMoves,
  describeTemplate,
  hasFacts,
  mergeTemplates,
  sectionWrite,
  templateForScope,
  type NoteTemplate,
  type SectionWrite,
} from "./templates";

/** What the plan needs to know about the vault and about Relate. */
export interface PlanFacts {
  noteExists(path: string): boolean;
  folderExists(path: string): boolean;
  /** Relate's guarded API, or null while it is absent or incompatible. */
  relate: RelateView | null;
  relateStatus: RelateStatus;
  now: Date;
}

/** Another section a card can move to, and the change the move makes. */
export interface PlannedMove {
  title: string;
  /** The change in words, such as "Set status to active". */
  change: string;
  template: NoteTemplate;
}

export interface PlannedSection {
  section: ComposedSection;
  title: string;
  /** What the section says when it has no cards. */
  emptyText: string;
  /** The section's + button: the facts a new note gets, and its tooltip. Null for no button. */
  create: { template: NoteTemplate; tooltip: string } | null;
  /** What a card dropped here becomes. Null when the section takes no cards. */
  drop: { template: NoteTemplate; hint: string } | null;
  /** The other sections on the page a card here can move to. */
  moves: PlannedMove[];
  /** Whether its cards can be dragged: some section on the page takes them. */
  draggable: boolean;
}

export type PagePlan =
  | { kind: "empty"; text: string }
  | {
      kind: "sections";
      sections: PlannedSection[];
      /** The template a section states, so a card that leaves it drops that section's value. */
      templateOf(sectionId: string): NoteTemplate | undefined;
    };

/**
 * Why a page cannot show at all: a deleted named page, or a note or folder
 * that was deleted or moved away. Null while the page is there.
 */
export function pageGone(page: ResolvedPage | null, facts: Pick<PlanFacts, "noteExists" | "folderExists">): string | null {
  if (!page) return "This page no longer exists.";
  if (page.note && !facts.noteExists(page.note)) return "This note no longer exists.";
  if (page.scope.kind === "folder" && page.scope.folder && !facts.folderExists(page.scope.folder)) {
    return "This folder no longer exists.";
  }
  return null;
}

/** Decide what a composed page shows. */
export function planPage(page: ResolvedPage, composed: ComposedPage, facts: PlanFacts): PagePlan {
  const writes = new Map<string, SectionWrite>(composed.configs.map((cfg) => [cfg.id, sectionWrite(cfg, facts.now)]));
  const takesMoves = (id: string) => {
    const w = writes.get(id);
    return w !== undefined && acceptsMoves(w);
  };

  // A scope narrows every section, so many come up empty there; the page
  // shows the ones that have cards, plus an empty one that takes moves, as
  // a place to move cards to. The home page keeps its empty sections,
  // which tell the reader why a section is bare. A Pinned section shows
  // only while it has pins to show, on every page.
  let sections = composed.sections;
  if (!page.isHome) sections = sections.filter((s) => s.cards.length > 0 || takesMoves(s.config.id));
  sections = sections.filter((s) => s.config.kind !== "pinned" || s.cards.length > 0);

  const empty = emptyPage(page, composed, sections.length, facts);
  if (empty) return { kind: "empty", text: empty };

  const pageTemplate = templateForScope(page.scope);
  const targets = sections.filter((s) => takesMoves(s.config.id));
  const planned = sections.map((section): PlannedSection => {
    const { config } = section;
    const write = writes.get(config.id);
    const own = write?.complete && hasFacts(write.template) ? mergeTemplates(pageTemplate, write.template) : null;
    return {
      section,
      title: sectionTitle(config),
      emptyText: section.claimed
        ? "Every matching note already appears in a section above."
        : (relateEmptyText(config, facts) ?? EMPTY_BY_KIND[config.kind] ?? "This section has no matching notes."),
      create: own ? { template: own, tooltip: `New note here: ${lowerFirst(describeTemplate(own))}` } : null,
      drop:
        write && takesMoves(config.id)
          ? { template: write.template, hint: `Drop to ${lowerFirst(describeTemplate(write.template))}` }
          : null,
      moves: targets
        .filter((t) => t.config.id !== config.id)
        .flatMap((t) => {
          const target = writes.get(t.config.id);
          return target ? [{ title: sectionTitle(t.config), change: describeTemplate(target.template), template: target.template }] : [];
        }),
      draggable: targets.length > 0,
    };
  });
  return { kind: "sections", sections: planned, templateOf: (id) => writes.get(id)?.template };
}

/** The line a page shows in place of its sections, or null when it shows them. */
function emptyPage(page: ResolvedPage, composed: ComposedPage, shown: number, facts: PlanFacts): string | null {
  const count = composed.notes;
  if (page.note && !shown) {
    // Similar notes can fill a note's page that has no links, so the page
    // is empty only when every section is.
    return facts.relate ? "This note has no links, backlinks or relationships yet." : "This note has no links or backlinks yet.";
  }
  if (!page.isHome && !page.note && count === 0) return emptyPageText(page);
  if (!shown) {
    if (composed.configs.some((cfg) => cfg.enabled)) return "No notes on this page match its sections.";
    return page.isHome
      ? "Turn on a section in Settings → Home Cards to fill this page."
      : "Turn on a section in this page's settings to fill it.";
  }
  // A new vault: one line beats a column of empty sections.
  if (count === 0 && !page.note) return "Cards appear here as you write notes.";
  return null;
}

/** What an empty section says when its source explains the emptiness better than "no matches". */
const EMPTY_BY_KIND: Partial<Record<SectionKind, string>> = {
  continue: "Notes you open on this device appear here, grouped by work session.",
  related: "Notes linked to what you open appear here.",
};

/** What an empty section that needs Relate says, when Relate explains the emptiness. */
function relateEmptyText(cfg: SectionConfig, facts: PlanFacts): string | undefined {
  const unlinked = cfg.kind === "rediscover" && cfg.strategy === "unlinked";
  if (cfg.kind !== "relate" && !unlinked) return undefined;
  if (facts.relateStatus === "incompatible") return RELATE_INCOMPATIBLE;
  const relate = facts.relate;
  if (cfg.kind === "relate") {
    if (!relate) return "This section shows a search from the Relate plugin, which is not running.";
    if (!cfg.query.trim()) return "Add a search in this section's settings.";
    return "Relate found no notes for this search.";
  }
  if (!relate) return "This strategy uses search by meaning from the Relate plugin, which is not running.";
  if (!relate.meaningReady()) return "Turn on search by meaning in Relate's settings to fill this section.";
  return undefined;
}

/** The line for a page with no notes in scope. */
function emptyPageText(page: ResolvedPage): string {
  switch (page.scope.kind) {
    case "folder":
      return "This folder has no notes yet. Cards appear here as you add them.";
    case "tag":
      return "No notes have this tag yet. Cards appear here as you tag them.";
    case "property":
      return "No notes have this property yet. Cards appear here as you add it.";
    default:
      return "Cards appear here as you write notes.";
  }
}

/** "Set status" → "set status", leaving values as they are. */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
