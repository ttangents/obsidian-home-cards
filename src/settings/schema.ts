/**
 * The settings schema: every persisted shape, every default, and every
 * closed set of choices the plugin offers.
 *
 * Choices live in registries of one shape, `{ id, label, ... }`. The
 * settings UI builds its dropdowns and galleries from them, the views
 * read their icons from them, and `normalize.ts` validates stored values
 * against them. Adding a choice is one registry entry; no other module
 * names ids directly.
 *
 * This module has no imports. Everything else may depend on it.
 */

interface Choice<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
}

// ------------------------------------------------------------- registries

/** How a section chooses its notes. Labels double as default headings. */
export const SECTION_KINDS = [
  { id: "recent-opened", label: "Recently opened" },
  { id: "recent-created", label: "Recently created" },
  { id: "recent-modified", label: "Recently modified" },
  { id: "property", label: "By property" },
  { id: "tag", label: "By tag" },
  { id: "most-linked", label: "Most popular" },
  { id: "least-linked", label: "Least popular" },
] as const satisfies readonly Choice[];
export type SectionKind = (typeof SECTION_KINDS)[number]["id"];

/** Page layouts, with the Lucide icon each toggle button shows. */
export const VIEW_MODES = [
  { id: "grid", label: "Grid", icon: "layout-grid" },
  { id: "rows", label: "Rows", icon: "list" },
] as const satisfies readonly (Choice & { icon: string })[];
export type ViewMode = (typeof VIEW_MODES)[number]["id"];

/**
 * Card surface treatments. Each differs in kind: Flat sits on the theme
 * surface with a hairline, Elevated lifts on the theme shadow, Frosted
 * blurs whatever lies behind it, Outline keeps only the hairline.
 */
export const SURFACES = [
  { id: "flat", label: "Flat" },
  { id: "elevated", label: "Elevated" },
  { id: "frosted", label: "Frosted" },
  { id: "outline", label: "Outline" },
] as const satisfies readonly Choice[];
export type Surface = (typeof SURFACES)[number]["id"];

/**
 * Page backgrounds. Plain leaves the theme canvas alone; every other
 * entry is a pattern with a light and a dark 400px tile.
 *
 * Adding a pattern: drop `<id>-light.png` and `<id>-dark.png` into
 * assets/tiles/, add the two variable lines and one selector in
 * styles/10-backgrounds.css, and add the entry here. The test suite
 * refuses a registry entry whose tiles or selector are missing.
 */
export const BACKGROUNDS = [
  { id: "plain", label: "Plain" },
  { id: "hearts", label: "Hearts" },
  { id: "leaves", label: "Leaves" },
  { id: "suns", label: "Suns" },
  { id: "waves", label: "Waves" },
  { id: "interlace", label: "Interlace" },
  { id: "regal", label: "Regal" },
  { id: "crosses", label: "Crosses" },
] as const satisfies readonly Choice[];
export type Background = (typeof BACKGROUNDS)[number]["id"];

/** Type guard: is `value` one of the registry's ids? */
export function isChoice<R extends readonly Choice[]>(
  registry: R,
  value: unknown
): value is R[number]["id"] {
  return registry.some((c) => c.id === value);
}

export function labelOf<R extends readonly Choice[]>(
  registry: R,
  id: R[number]["id"]
): string {
  return registry.find((c) => c.id === id)?.label ?? id;
}

// ----------------------------------------------------------------- shapes

export type SortDir = "desc" | "asc";

export interface SectionConfig {
  id: string;
  /** Blank means "derive the heading from the configuration". */
  title: string;
  kind: SectionKind;
  count: number;
  enabled: boolean;
  /** `property` sections: the frontmatter key that admits a note. */
  propertyKey: string;
  /** Optional value that key must hold, e.g. type = Project. */
  propertyValue: string;
  /** Frontmatter key to sort on; notes without it fall back to mtime. */
  sortKey: string;
  sortDir: SortDir;
  /** `tag` sections: the tag, descendants included. */
  tag: string;
  /** Include-filters in Notebook Navigator's idiom; see compose/scope.ts. */
  filterTags: string;
  filterProps: string;
  filterFolders: string;
}

export interface HomeCardsSettings {
  sections: SectionConfig[];
  dedupe: boolean;

  greetingEnabled: boolean;
  /** Pin the greeting on fixed-date holidays (New Year, Christmas...). */
  greetingOccasions: boolean;
  greetingName: string;
  showNoteCount: boolean;
  openOnStartup: boolean;

  defaultView: ViewMode;
  cardMinWidth: number;
  cardSurface: Surface;
  background: Background;
  accentRubrics: boolean;

  /** Frontmatter key whose value becomes the card's type label. */
  typeProperty: string;
  showGlyph: boolean;
  typifyIcons: boolean;
  showRubric: boolean;
  showTags: boolean;
  maxTags: number;
  showDeks: boolean;
  dekLines: number;
  showFileSize: boolean;

  summaryProperty: string;
  boilerplateOpeners: string;
  titlePrefixes: string;
  stripTrailingDates: boolean;
}

// --------------------------------------------------------------- defaults

/**
 * A section with no opinions. Stored sections merge against this rather
 * than a real default, so a field missing on disk cannot import another
 * section's source or id.
 */
export const BLANK_SECTION: Readonly<SectionConfig> = {
  id: "",
  title: "",
  kind: "recent-modified",
  count: 8,
  enabled: true,
  propertyKey: "",
  propertyValue: "",
  sortKey: "",
  sortDir: "desc",
  tag: "",
  filterTags: "",
  filterProps: "",
  filterFolders: "",
};

/**
 * The first-run page. Every section works in any vault, so a new user
 * sees cards before configuring anything; property and tag sections
 * need keys only the user knows.
 */
export function defaultSections(): SectionConfig[] {
  return [
    { ...BLANK_SECTION, id: "opened", kind: "recent-opened" },
    { ...BLANK_SECTION, id: "created", kind: "recent-created" },
    { ...BLANK_SECTION, id: "most", kind: "most-linked" },
    { ...BLANK_SECTION, id: "least", kind: "least-linked" },
  ];
}

export function defaultSettings(): HomeCardsSettings {
  return {
    sections: defaultSections(),
    dedupe: true,

    greetingEnabled: true,
    greetingOccasions: true,
    greetingName: "",
    showNoteCount: true,
    openOnStartup: false,

    defaultView: "grid",
    cardMinWidth: 262,
    cardSurface: "flat",
    background: "plain",
    accentRubrics: true,

    typeProperty: "type",
    showGlyph: true,
    typifyIcons: false,
    showRubric: true,
    showTags: true,
    maxTags: 3,
    showDeks: true,
    dekLines: 3,
    showFileSize: false,

    summaryProperty: "summary",
    boilerplateOpeners: "this note, this document, this page",
    titlePrefixes: "",
    stripTrailingDates: true,
  };
}

/** Numeric bounds, shared by the settings sliders and the normalizer. */
export const LIMITS = {
  count: { min: 1, max: 24 },
  cardMinWidth: { min: 180, max: 420 },
  maxTags: { min: 1, max: 6 },
  dekLines: { min: 1, max: 8 },
} as const;

export function newSectionId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// --------------------------------------------------------------- headings

/** The heading a section shows when its title is blank. */
export function autoTitle(cfg: SectionConfig): string {
  switch (cfg.kind) {
    case "tag":
      return cfg.tag ? `#${cfg.tag.replace(/^#/, "")}` : labelOf(SECTION_KINDS, cfg.kind);
    case "property": {
      const k = cfg.propertyKey;
      if (!k) return labelOf(SECTION_KINDS, cfg.kind);
      if (cfg.propertyValue) return `${k}: ${cfg.propertyValue}`;
      return `By ${k.charAt(0).toLowerCase()}${k.slice(1)}`;
    }
    default:
      return labelOf(SECTION_KINDS, cfg.kind);
  }
}

export function sectionTitle(cfg: SectionConfig): string {
  return cfg.title.trim() || autoTitle(cfg);
}
