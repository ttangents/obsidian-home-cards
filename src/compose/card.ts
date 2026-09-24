/**
 * The card model: everything a renderer needs about one note, assembled
 * from metadata plus (optionally) one byte-range read for its dek.
 */

import type { App, TFile } from "obsidian";
import type { HomeCardsSettings } from "../settings/schema";
import { tagsOf } from "./scope";
import { cleanTitle } from "./text";
import { firstValue, formatDate, frontmatterValue, parseDateLike } from "./values";

export interface CardItem {
  file: TFile;
  title: string;
  /** The note's type property, verbatim; "" when it declares none. */
  rubric: string;
  /** Typify icon name for the type; "" when none applies. */
  icon: string;
  tags: string[];
  /**
   * Opening sentence. `null` means "not fetched": the renderer fills it
   * lazily as the card scrolls into view. "" means fetched and absent.
   */
  dek: string | null;
  /** Footer line: the ranked-on figure, the sort value, the file size. */
  meta: string;
  /** Lowercased haystack for the view's filter box. */
  search: string;
}

/** Resolves a note's opening sentence. */
export type DekSource = (file: TFile) => Promise<string>;

/** Per-section inputs to card assembly, built once per compose. */
export interface CardContext {
  app: App;
  settings: HomeCardsSettings;
  /** Frontmatter key whose value the footer reports. */
  metaKey: string;
  /** Typify icons by lowercase type; empty when the feature is off. */
  icons: ReadonlyMap<string, string>;
  /** Omit to leave deks `null` for the renderer to fill lazily. */
  deks?: DekSource;
}

function footer(ctx: CardContext, file: TFile, rubric: string, lead?: string): string {
  const cache = ctx.app.metadataCache.getFileCache(file);
  const bits: string[] = [];
  if (lead) bits.push(lead);
  const raw =
    firstValue(frontmatterValue(cache, ctx.metaKey)) || firstValue(frontmatterValue(cache, "date"));
  if (raw) {
    const date = parseDateLike(raw);
    // A non-date value that merely repeats the type label adds nothing.
    if (date) bits.push(formatDate(date));
    else if (raw !== rubric) bits.push(raw);
  }
  if (ctx.settings.showFileSize) {
    bits.push(`${Math.max(1, Math.round(file.stat.size / 1024))} KB`);
  }
  return bits.join(" · ");
}

export async function buildCard(ctx: CardContext, file: TFile, lead?: string): Promise<CardItem> {
  const { app, settings } = ctx;
  const cache = app.metadataCache.getFileCache(file);
  const rubric = firstValue(frontmatterValue(cache, settings.typeProperty));
  const tags = settings.showTags
    ? [...new Set(tagsOf(cache).map((t) => t.trim()).filter(Boolean))].slice(0, settings.maxTags)
    : [];
  const dek = ctx.deks ? await ctx.deks(file) : null;

  return {
    file,
    title: cleanTitle(file.basename, settings),
    rubric,
    icon: ctx.icons.get(rubric.toLowerCase()) ?? "",
    tags,
    dek,
    meta: footer(ctx, file, rubric, lead),
    search: [file.basename, rubric, dek ?? "", ...tags].join(" ").toLowerCase(),
  };
}
