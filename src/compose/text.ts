/**
 * Card text: the headline cleaned of filing conventions, and the opening
 * sentence ("dek") lifted from a note's first prose block.
 */

import type { App, CachedMetadata, TFile } from "obsidian";
import type { HomeCardsSettings } from "../settings/schema";
import { firstValue, frontmatterValue, memoLast, splitList } from "./values";

type TextSettings = Pick<
  HomeCardsSettings,
  "titlePrefixes" | "stripTrailingDates" | "showDeks" | "summaryProperty" | "boilerplateOpeners"
>;

// ------------------------------------------------------------- headlines

/**
 * A trailing date stamp: "@20260716", "@2026-07-16" or "2026-07-16",
 * optionally after "on" and before "update". Undashed digits require the
 * @ marker, so "Invoice 12345678" keeps its number.
 */
const TRAILING_DATE =
  /([,\s]+|^)(?:on\s+)?(@\d{4}-?\d{2}-?\d{2}|\d{4}-\d{2}-\d{2})(\s+update)?\s*$/i;

function isRealDateStamp(stamp: string): boolean {
  const digits = stamp.replace(/[@-]/g, "");
  if (digits.length !== 8) return false;
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

const titlePrefixList = memoLast(splitList);

/** The headline as displayed. A title that is only a date survives. */
export function cleanTitle(name: string, s: TextSettings): string {
  let t = name;
  for (const p of titlePrefixList(s.titlePrefixes)) {
    if (t.startsWith(p)) {
      t = t.slice(p.length).trim();
      break;
    }
  }
  if (s.stripTrailingDates) {
    const m = TRAILING_DATE.exec(t);
    if (m && isRealDateStamp(m[2])) t = t.slice(0, m.index).replace(/[,\s]+$/, "");
  }
  return t || name;
}

// ------------------------------------------------------------------ deks

/**
 * Only `paragraph` blocks count as prose. An allowlist, because the
 * metadata cache types comments, callouts, tables, code and HTML as
 * other things, and every one of those reads badly as a sentence.
 */
const PROSE_SECTION = "paragraph";

/** Sentences shorter than this are fragments ("Draft."), not openings. */
const MIN_SENTENCE = 12;

const openerList = memoLast((raw: string) => splitList(raw).map((o) => o.toLowerCase()));

/** Strip wiki links, markdown links and inline emphasis to plain text. */
function flatten(markdown: string): string {
  return markdown
    .replace(/!?\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`=~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The fields of settings that shape extraction. The dek cache keys on
 * this so it invalidates itself when, and only when, these change.
 */
export function dekSignature(s: TextSettings): string {
  return `${s.showDeks}\u0000${s.summaryProperty}\u0000${s.boilerplateOpeners}`;
}

/**
 * The note's opening sentence: the summary property when the note sets
 * one, else the first qualifying sentence of the first prose block.
 * Reads only that block's byte range. Returns "" rather than a sentence
 * the boilerplate list exists to suppress.
 */
export async function extractDek(
  app: App,
  file: TFile,
  cache: CachedMetadata | null,
  s: TextSettings
): Promise<string> {
  if (!s.showDeks) return "";
  const override = firstValue(frontmatterValue(cache, s.summaryProperty));
  if (override) return override;

  const block = (cache?.sections ?? []).find((sec) => sec.type === PROSE_SECTION);
  if (!block) return "";

  let text: string;
  try {
    const content = await app.vault.cachedRead(file);
    text = content.slice(block.position.start.offset, block.position.end.offset);
  } catch {
    return "";
  }
  const flat = flatten(text);
  if (!flat) return "";

  const openers = openerList(s.boilerplateOpeners);
  for (const sentence of flat.split(/(?<=[.?!])\s+/).slice(0, 3)) {
    const lower = sentence.toLowerCase();
    if (openers.some((o) => lower.startsWith(o))) continue;
    if (sentence.length >= MIN_SENTENCE) return sentence;
  }
  return "";
}
