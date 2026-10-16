/**
 * Rehydrate settings from data.json.
 *
 * data.json is user-editable, survives downgrades, and carries keys from
 * every past version, so this module treats it as untrusted input. The
 * output is built field by field from the schema: each value is
 * type-checked, range-clamped or registry-validated, and anything the
 * schema does not name (retired keys, typos) is dropped by construction.
 *
 * Migrations run first, oldest to newest, and translate retired shapes
 * into current ones. Each carries the version that retired its input so
 * the list can be pruned once no install could still hold it.
 *
 * Pure: no App, no I/O. main.ts calls it once on load; the tests call it
 * directly.
 */

import { CUSTOM_BACKGROUNDS, isCustomId, isStoredFileName } from "./custom-background";
import { normalizeFolderPath } from "./folder-pages";
import {
  BACKGROUND_FITS,
  BACKGROUNDS,
  BLANK_SECTION,
  defaultSections,
  defaultSettings,
  LIMITS,
  newSectionId,
  SECTION_KINDS,
  SURFACES,
  VIEW_MODES,
  type CustomBackground,
  type FolderPage,
  type HomeCardsSettings,
  type SectionConfig,
} from "./schema";

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" ? v : fallback;

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

function int(v: unknown, fallback: number, range: { min: number; max: number }): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(n)));
}

function choice<R extends readonly { id: string }[]>(
  registry: R,
  v: unknown,
  fallback: R[number]["id"]
): R[number]["id"] {
  return registry.some((c) => c.id === v) ? (v as R[number]["id"]) : fallback;
}

// ------------------------------------------------------------- migrations

/** Headings earlier versions stored literally; blanked so they derive. */
const LEGACY_TITLES = new Set([
  "Recently opened",
  "Recently created",
  "Recently modified",
  "By dateline",
  "Referenced but never written",
  "New section",
]);

function migrate(raw: Raw): Raw {
  const r: Raw = { ...raw };

  // ≤1.7: "masonry" became "tiles"; 1.19 retired tiles. Both land on grid.
  if (r.defaultView === "masonry" || r.defaultView === "tiles") r.defaultView = "grid";

  // 1.9 paper textures and 1.10's pattern toggle both meant the sun tile.
  if (typeof r.paperStyle === "string" && r.paperStyle !== "blank") r.background = "suns";
  if (r.backgroundPattern === true) r.background = "suns";

  // 1.22 replaced the pattern set. Leaves and Suns keep their ids with
  // new artwork; each retired pattern moves to its nearest replacement.
  const retiredPatterns: Raw = {
    hearts: "diamonds",
    interlace: "diamonds",
    regal: "diamonds",
    crosses: "diamonds",
    waves: "stitches",
  };
  if (typeof r.background === "string" && r.background in retiredPatterns) {
    r.background = retiredPatterns[r.background];
  }

  // ≤1.17 surfaces were three theme shades; ≤1.27 also had Outline, which
  // left cards unreadable over patterns. Map each onto the nearest surface.
  const surfaceMap: Raw = {
    secondary: "flat",
    "primary-alt": "elevated",
    transparent: "frosted",
    outline: "frosted",
  };
  if (typeof r.cardSurface === "string" && r.cardSurface in surfaceMap) {
    r.cardSurface = surfaceMap[r.cardSurface];
  }

  // ≤1.19 named the file-size toggle `showWordCount`.
  if (!("showFileSize" in r) && typeof r.showWordCount === "boolean") {
    r.showFileSize = r.showWordCount;
  }
  return r;
}

// --------------------------------------------------------------- sections

function normalizeSection(e: Raw, index: number): SectionConfig[] {
  // ≤1.7 "unresolved" source: becomes a most-linked section plus a
  // least-linked companion inserted after it.
  const legacyUnresolved = e.kind === "unresolved";
  const title = str(e.title, "");

  const cfg: SectionConfig = {
    id: str(e.id, "") || `s${index}-${newSectionId()}`,
    title: legacyUnresolved || LEGACY_TITLES.has(title.trim()) ? "" : title,
    kind: legacyUnresolved ? "most-linked" : choice(SECTION_KINDS, e.kind, BLANK_SECTION.kind),
    count: int(e.count, BLANK_SECTION.count, LIMITS.count),
    enabled: e.enabled !== false,
    propertyKey: str(e.propertyKey, ""),
    propertyValue: str(e.propertyValue, ""),
    sortKey: str(e.sortKey, ""),
    sortDir: e.sortDir === "asc" ? "asc" : "desc",
    tag: str(e.tag, ""),
    filterTags: str(e.filterTags, ""),
    filterProps: str(e.filterProps, ""),
    filterFolders: str(e.filterFolders, ""),
  };
  if (!legacyUnresolved) return [cfg];
  return [cfg, { ...BLANK_SECTION, id: `${cfg.id}-least`, kind: "least-linked" }];
}

export function normalizeSections(raw: unknown): SectionConfig[] {
  if (!Array.isArray(raw)) return defaultSections();
  const seen = new Set<string>();
  const out: SectionConfig[] = [];
  raw.forEach((entry, i) => {
    if (!isObject(entry)) return;
    for (const cfg of normalizeSection(entry, i)) {
      while (seen.has(cfg.id)) cfg.id += "x";
      seen.add(cfg.id);
      out.push(cfg);
    }
  });
  return out.length ? out : defaultSections();
}

/**
 * Folder pages with sections of their own. An entry without a usable
 * folder path or without sections is dropped: that folder then inherits
 * the home page's sections, which is what an entry-less folder does.
 */
export function normalizeFolderPages(raw: unknown): FolderPage[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: FolderPage[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const path = normalizeFolderPath(str(entry.path, ""));
    if (!path || seen.has(path) || !Array.isArray(entry.sections) || !entry.sections.length) continue;
    seen.add(path);
    out.push({ path, sections: normalizeSections(entry.sections) });
  }
  return out;
}

/**
 * Custom backgrounds. The file name is checked as hard as the id: it
 * becomes a path inside the plugin's folder, so it must never carry a
 * separator or a dot-segment, whatever data.json says.
 */
export function normalizeCustomBackgrounds(raw: unknown): CustomBackground[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CustomBackground[] = [];
  for (const entry of raw) {
    if (out.length >= CUSTOM_BACKGROUNDS.max) break;
    if (!isObject(entry)) continue;
    const id = str(entry.id, "");
    const file = str(entry.file, "");
    if (!isCustomId(id) || seen.has(id) || !isStoredFileName(file)) continue;
    seen.add(id);
    out.push({
      id,
      label: str(entry.label, "").trim().slice(0, CUSTOM_BACKGROUNDS.maxLabel) || "Background",
      file,
      fit: choice(BACKGROUND_FITS, entry.fit, "pattern"),
      width: int(entry.width, 400, { min: CUSTOM_BACKGROUNDS.minEdge, max: CUSTOM_BACKGROUNDS.pictureEdge }),
      fade: int(entry.fade, CUSTOM_BACKGROUNDS.defaultFade, LIMITS.fade),
    });
  }
  return out;
}

// --------------------------------------------------------------- settings

export function normalizeSettings(stored: unknown): HomeCardsSettings {
  const d = defaultSettings();
  if (!isObject(stored)) return d;
  const r = migrate(stored);

  const customBackgrounds = normalizeCustomBackgrounds(r.customBackgrounds);
  const background = str(r.background, d.background);

  return {
    sections: normalizeSections(r.sections),
    folderPages: normalizeFolderPages(r.folderPages),
    dedupe: bool(r.dedupe, d.dedupe),
    rediscoverMonths: int(r.rediscoverMonths, d.rediscoverMonths, LIMITS.rediscoverMonths),

    greetingEnabled: bool(r.greetingEnabled, d.greetingEnabled),
    greetingOccasions: bool(r.greetingOccasions, d.greetingOccasions),
    greetingName: str(r.greetingName, d.greetingName),
    showNoteCount: bool(r.showNoteCount, d.showNoteCount),
    openOnStartup: bool(r.openOnStartup, d.openOnStartup),

    defaultView: choice(VIEW_MODES, r.defaultView, d.defaultView),
    cardMinWidth: int(r.cardMinWidth, d.cardMinWidth, LIMITS.cardMinWidth),
    cardSurface: choice(SURFACES, r.cardSurface, d.cardSurface),
    // A stored custom id survives only while its record does.
    background:
      BACKGROUNDS.some((b) => b.id === background) || customBackgrounds.some((b) => b.id === background)
        ? background
        : d.background,
    customBackgrounds,
    accentRubrics: bool(r.accentRubrics, d.accentRubrics),

    // Blank falls back to the default: a card always has a type key.
    typeProperty: str(r.typeProperty, d.typeProperty).trim() || d.typeProperty,
    showGlyph: bool(r.showGlyph, d.showGlyph),
    typifyIcons: bool(r.typifyIcons, d.typifyIcons),
    showRubric: bool(r.showRubric, d.showRubric),
    showTags: bool(r.showTags, d.showTags),
    maxTags: int(r.maxTags, d.maxTags, LIMITS.maxTags),
    showDeks: bool(r.showDeks, d.showDeks),
    dekLines: int(r.dekLines, d.dekLines, LIMITS.dekLines),
    showFileSize: bool(r.showFileSize, d.showFileSize),

    summaryProperty: str(r.summaryProperty, d.summaryProperty).trim(),
    boilerplateOpeners: str(r.boilerplateOpeners, d.boilerplateOpeners),
    titlePrefixes: str(r.titlePrefixes, d.titlePrefixes),
    stripTrailingDates: bool(r.stripTrailingDates, d.stripTrailingDates),
  };
}

