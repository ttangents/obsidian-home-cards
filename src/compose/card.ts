/**
 * The card model: everything a renderer needs about one note, assembled
 * from metadata plus (optionally) one byte-range read for its dek.
 */

import type { CachedMetadata, TFile } from "obsidian";
import type { CardImage, HomeCardsSettings } from "../settings/schema";
import { projectFields } from "./projection";
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
  /** Footer line: why the card is here, then its fields or the sort value, then the file size. */
  meta: string;
  /** Resource URL of the card's image; null when it shows none. */
  image: string | null;
  imageMode: CardImage;
  /**
   * What the section shows for images, whether or not this note has one.
   * A card without its own image keeps the place with a lettered tile, so
   * every card in a section lines up.
   */
  imageSlot: CardImage;
  /** Lowercased haystack for the view's filter box. */
  search: string;
}

/** Resolves a note's opening sentence. */
export type DekSource = (file: TFile) => Promise<string>;

/** Per-section inputs to card assembly, built once per compose. */
export interface CardContext {
  settings: HomeCardsSettings;
  /** The note's cached metadata; see VaultSnapshot.cacheOf. */
  cacheOf: (file: TFile) => CachedMetadata | null;
  /** The moment of the compose; dates on cards read from it. */
  now: Date;
  /** Frontmatter key whose value the default footer reports. */
  metaKey: string;
  /** The section's footer fields; empty keeps the default footer. */
  fields: readonly string[];
  image: CardImage;
  /** Finds a card's image; omitted where images are not offered. */
  imageUrl?: (file: TFile, cache: CachedMetadata | null) => string | null;
  /** Typify icons by lowercase type; empty when the feature is off. */
  icons: ReadonlyMap<string, string>;
  /** Omit to leave deks `null` for the renderer to fill lazily. */
  deks?: DekSource;
}

function footer(ctx: CardContext, file: TFile, cache: CachedMetadata | null, rubric: string, lead?: string): string {
  const bits: string[] = [];
  if (lead) bits.push(lead);
  if (ctx.fields.length) {
    bits.push(...projectFields(file, cache, ctx.fields, ctx.now));
  } else {
    const raw =
      firstValue(frontmatterValue(cache, ctx.metaKey)) || firstValue(frontmatterValue(cache, "date"));
    if (raw) {
      const date = parseDateLike(raw);
      // A non-date value that merely repeats the type label adds nothing.
      if (date) bits.push(formatDate(date));
      else if (raw !== rubric) bits.push(raw);
    }
  }
  if (ctx.settings.showFileSize) {
    bits.push(`${Math.max(1, Math.round(file.stat.size / 1024))} KB`);
  }
  return bits.join(" · ");
}

export async function buildCard(ctx: CardContext, file: TFile, lead?: string): Promise<CardItem> {
  const { settings } = ctx;
  const cache = ctx.cacheOf(file);
  const rubric = firstValue(frontmatterValue(cache, settings.typeProperty));
  const tags = settings.showTags
    ? [...new Set(tagsOf(cache).map((t) => t.trim()).filter(Boolean))].slice(0, settings.maxTags)
    : [];
  const dek = ctx.deks ? await ctx.deks(file) : null;
  const meta = footer(ctx, file, cache, rubric, lead);
  const image = ctx.image !== "none" && ctx.imageUrl ? ctx.imageUrl(file, cache) : null;

  return {
    file,
    title: cleanTitle(file.basename, settings),
    rubric,
    icon: ctx.icons.get(rubric.toLowerCase()) ?? "",
    tags,
    dek,
    meta,
    image,
    imageMode: image ? ctx.image : "none",
    imageSlot: ctx.imageUrl ? ctx.image : "none",
    search: [file.basename, rubric, dek ?? "", meta, ...tags].join(" ").toLowerCase(),
  };
}
