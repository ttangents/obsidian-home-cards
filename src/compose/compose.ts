/**
 * Compose the page: rank each enabled section, apply "one section per
 * note", and assemble the winners into cards. The single entry point the
 * home view calls; pure apart from the vault reads it delegates.
 */

import type { App } from "obsidian";
import type { HomeCardsSettings, SectionConfig } from "../settings/schema";
import { buildCard, type CardContext, type CardItem, type DekSource } from "./card";
import { rankSection, type Ranked } from "./rank";
import { loadTypifyIcons, VaultSnapshot } from "./vault";

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

/** Typify icons when the glyph setting asks for them, else none. */
export async function iconsFor(
  app: App,
  settings: HomeCardsSettings
): Promise<ReadonlyMap<string, string>> {
  return settings.showGlyph && settings.typifyIcons
    ? loadTypifyIcons(app, settings.typeProperty)
    : new Map();
}

export async function composeSections(
  app: App,
  settings: HomeCardsSettings,
  deks?: DekSource,
  now = new Date()
): Promise<ComposedSection[]> {
  const icons = await iconsFor(app, settings);
  const vault = new VaultSnapshot(app, now);
  const taken = new Set<string>();
  const sections = settings.sections.filter((cfg) => cfg.enabled);

  // First pass: each section claims its visible cards, in order, so
  // section order sets precedence.
  const ranked = sections.map((cfg) => {
    const all = rankSection(vault, cfg, settings);
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

  return Promise.all(
    ranked.map(async ({ cfg, picked, claimed }, i) => {
      const ctx: CardContext = {
        app,
        settings,
        metaKey: cfg.sortKey || cfg.propertyKey || "date",
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
}
