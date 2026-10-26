/**
 * Compose the page: rank each enabled section, apply "one section per
 * note", and assemble the winners into cards. The single entry point the
 * home view calls; pure apart from the vault reads it delegates.
 */

import type { App } from "obsidian";
import type { HomeCardsSettings, SectionConfig } from "../settings/schema";
import { buildCard, type CardContext, type CardItem, type DekSource } from "./card";
import { rankSection, type Ranked } from "./rank";
import type { ActivityFacts } from "./activity";
import type { ScopeTest } from "./scope";
import { loadTypifyIcons } from "./legacy-typify";
import { VaultSnapshot } from "./vault";
import { relateView, runSearches, type RelateApi, type SearchOptions } from "./relate";
import { neighbourCount, noteSections } from "./note-page";

export interface ComposedSection {
  config: SectionConfig;
  cards: CardItem[];
  /**
   * Further matches, held back for "See more". Their deks stay null and
   * load as they scroll into view, so holding them costs no file reads.
   */
  more: CardItem[];
  /** Matches skipped because an earlier section already shows them. */
  claimed: number;
}

/** "See more" can reveal this many pages of `count` cards beyond the first. */
export const MORE_PAGES = 3;

/**
 * The enabled sections in page order: Pinned sections first, wherever the
 * list puts them, then the rest in list order. Pins are what the reader
 * chose to keep in view, so they lead the page and claim their notes
 * before any other section does.
 */
export function pageOrder(sections: readonly SectionConfig[]): SectionConfig[] {
  const enabled = sections.filter((cfg) => cfg.enabled);
  return [...enabled.filter((cfg) => cfg.kind === "pinned"), ...enabled.filter((cfg) => cfg.kind !== "pinned")];
}

/** Typify icons when the glyph setting asks for them, else none. */
export async function iconsFor(
  app: App,
  settings: HomeCardsSettings
): Promise<ReadonlyMap<string, string>> {
  return settings.showGlyph && settings.typifyIcons
    ? loadTypifyIcons(app, settings.typeProperty)
    : new Map();
}

export interface ComposeOptions {
  /** Fills deks of the visible cards; without one they load lazily. */
  deks?: DekSource;
  /** The moment of the compose. */
  now?: Date;
  /** The plugin's open history, for "Recently opened" beyond Obsidian's ten. */
  opened?: readonly string[];
  /** The sections to compose; the home page's when omitted. */
  sections?: readonly SectionConfig[];
  /** Limits the page to the notes this admits; every note when omitted. */
  scope?: ScopeTest | null;
  /** Opens and visits Home Cards observed, for the activity-based sections. */
  activity?: ActivityFacts;
  /** Relate's API, when Relate is installed and running. */
  relate?: RelateApi | null;
  /** How Relate searches are waited for and kept; see relate.ts. */
  searches?: SearchOptions;
  /** A note's page: the note's path. Its sections come from the note, and `sections` is ignored. */
  note?: string;
}

/** A composed page: its sections, the configurations they came from, and how many notes it covers. */
export interface ComposedPage {
  sections: ComposedSection[];
  configs: SectionConfig[];
  /** Notes in the page's scope, or, on a note's page, the notes it is connected to. */
  notes: number;
}

/**
 * A section's ranked notes. A section that fails, such as one whose source
 * calls into another plugin, comes back empty and leaves the rest of the
 * page as it is.
 */
function rankSafely(vault: VaultSnapshot, cfg: SectionConfig, settings: HomeCardsSettings): Ranked[] {
  try {
    return rankSection(vault, cfg, settings);
  } catch (err) {
    console.error(`Home Cards: could not fill the section "${cfg.id}"`, err);
    return [];
  }
}

export async function composePage(
  app: App,
  settings: HomeCardsSettings,
  { deks, now = new Date(), opened = [], sections: listed = settings.sections, scope = null, activity, relate = null, searches: searchOptions, note }: ComposeOptions = {}
): Promise<ComposedPage> {
  const icons = await iconsFor(app, settings);
  // Relate's search is asynchronous and ranking is not, so its searches run first.
  const queries = note ? [] : listed.filter((cfg) => cfg.enabled && cfg.kind === "relate").map((cfg) => cfg.query);
  const searches = relate && queries.length ? await runSearches(relate, queries, searchOptions) : new Map();
  // One snapshot serves the whole page, a note's page included.
  const vault = new VaultSnapshot(app, now, opened, scope, activity, relate ? relateView(relate, searches) : null);
  const configs = note ? noteSections(note, vault.relate, vault.links()) : [...listed];
  const notes = note ? neighbourCount(note, vault.links(), vault.relate) : vault.files.length;
  const sections = pageOrder(configs);
  const taken = new Set<string>();

  // First pass: each section claims its visible cards, in order, so
  // section order sets precedence.
  const ranked = sections.map((cfg) => {
    const all = rankSafely(vault, cfg, settings);
    const picked: Ranked[] = [];
    let claimed = 0;
    let next = 0;
    for (; next < all.length && picked.length < cfg.count; next++) {
      const r = all[next];
      if (settings.dedupe && taken.has(r.file.path)) {
        claimed++;
        continue;
      }
      picked.push(r);
    }
    for (const r of picked) taken.add(r.file.path);
    return { cfg, all, next, picked, claimed };
  });

  // Second pass: held-back cards, which never take a note that any
  // section shows up front.
  const extras = ranked.map(({ cfg, all, next }) => {
    const more: Ranked[] = [];
    for (let i = next; i < all.length && more.length < cfg.count * MORE_PAGES; i++) {
      const r = all[i];
      if (settings.dedupe && taken.has(r.file.path)) continue;
      more.push(r);
      if (settings.dedupe) taken.add(r.file.path);
    }
    return more;
  });

  const composed = await Promise.all(
    ranked.map(async ({ cfg, picked, claimed }, i) => {
      const ctx: CardContext = {
        settings,
        cacheOf: (f) => vault.cacheOf(f),
        now,
        metaKey: cfg.sortKey || cfg.propertyKey || "date",
        fields: cfg.fields,
        image: cfg.image,
        imageUrl: (f, cache) => vault.imageUrl(f, cache, settings.imageProperties),
        icons,
        deks,
      };
      const lazy: CardContext = { ...ctx, deks: undefined };
      const [cards, more] = await Promise.all([
        Promise.all(picked.map((r) => buildCard(ctx, r.file, r.lead))),
        Promise.all(extras[i].map((r) => buildCard(lazy, r.file, r.lead))),
      ]);
      return { config: cfg, cards, more, claimed };
    })
  );
  return { sections: composed, configs, notes };
}
