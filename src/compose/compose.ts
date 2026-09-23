/**
 * Compose the page: rank each enabled section, apply "one section per
 * note", and assemble the winners into cards. The single entry point the
 * home view calls; pure apart from the vault reads it delegates.
 */

import type { App } from "obsidian";
import type { HomeCardsSettings, SectionConfig } from "../settings/schema";
import { buildCard, type CardContext, type CardItem, type DekSource } from "./card";
import { rankSection, type Ranked } from "./rank";
import { loadTypifyIcons } from "./vault";

export interface ComposedSection {
  config: SectionConfig;
  cards: CardItem[];
}

/** Typify icons when the glyph setting asks for them, else none. */
export async function iconsFor(
  app: App,
  settings: HomeCardsSettings
): Promise<ReadonlyMap<string, string>> {
  return settings.showGlyph && settings.typifyIcons ? loadTypifyIcons(app) : new Map();
}

export async function composeSections(
  app: App,
  settings: HomeCardsSettings,
  deks?: DekSource
): Promise<ComposedSection[]> {
  const icons = await iconsFor(app, settings);
  const taken = new Set<string>();
  const out: ComposedSection[] = [];

  for (const cfg of settings.sections) {
    if (!cfg.enabled) continue;

    // Sections claim notes in order, so section order sets precedence.
    const picked: Ranked[] = [];
    for (const r of rankSection(app, cfg, settings)) {
      if (settings.dedupe && taken.has(r.file.path)) continue;
      picked.push(r);
      if (picked.length >= cfg.count) break;
    }
    for (const r of picked) taken.add(r.file.path);

    const ctx: CardContext = {
      app,
      settings,
      metaKey: cfg.sortKey || cfg.propertyKey || "date",
      icons,
      deks,
    };
    const cards = await Promise.all(picked.map((r) => buildCard(ctx, r.file, r.lead)));
    out.push({ config: cfg, cards });
  }
  return out;
}
