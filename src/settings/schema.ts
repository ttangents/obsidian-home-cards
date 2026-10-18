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
  { id: "rediscover", label: "Rediscover" },
  { id: "pinned", label: "Pinned" },
  { id: "continue", label: "Continue working" },
  { id: "related", label: "Related to recent work" },
] as const satisfies readonly Choice[];
export type SectionKind = (typeof SECTION_KINDS)[number]["id"];

/**
 * How a Rediscover section chooses among notes. Each is a plain rule over
 * dates, links and opens, and each card says which fact put it there; see
 * compose/rediscover.ts.
 */
export const REDISCOVER_STRATEGIES = [
  { id: "forgotten", label: "Forgotten notes", desc: "Notes untouched for the months set in General, in a new order each day." },
  { id: "gems", label: "Forgotten gems", desc: "Untouched notes that other notes still link to, the most linked first." },
  { id: "unfinished", label: "Unfinished thoughts", desc: "Untouched notes that are short and barely linked." },
  { id: "on-this-day", label: "On this day", desc: "Notes created or last edited in this week of an earlier year." },
  { id: "hubs", label: "Sleeping hubs", desc: "Untouched notes with many links in and out, not opened lately." },
  { id: "old-friends", label: "Old friends", desc: "Notes you opened often that you have not opened for a while." },
] as const satisfies readonly (Choice & { desc: string })[];
export type RediscoverStrategy = (typeof REDISCOVER_STRATEGIES)[number]["id"];

/** Page layouts, with the Lucide icon each toggle button shows. */
export const VIEW_MODES = [
  { id: "grid", label: "Grid", icon: "layout-grid" },
  { id: "rows", label: "Rows", icon: "list" },
] as const satisfies readonly (Choice & { icon: string })[];
export type ViewMode = (typeof VIEW_MODES)[number]["id"];

/**
 * Card surface treatments, each different in kind: Flat sits on the
 * theme's secondary surface inside a hairline, Elevated lifts on the
 * theme's shadow, Frosted blurs the background pattern behind it. Their
 * tokens live in styles/05-surfaces.css.
 */
export const SURFACES = [
  { id: "flat", label: "Flat" },
  { id: "elevated", label: "Elevated" },
  { id: "frosted", label: "Frosted" },
] as const satisfies readonly Choice[];
export type Surface = (typeof SURFACES)[number]["id"];

/**
 * Page backgrounds. Plain leaves the theme canvas alone; every other
 * entry is a pattern with a light and a dark tile, each a seamless WebP
 * 800px wide (drawn at 400 CSS px) and any height.
 *
 * Adding a pattern: drop `<id>-light.webp` and `<id>-dark.webp` into
 * assets/tiles/, add its tile and veil variables and one selector in
 * styles/10-backgrounds.css, and add the entry here. The test suite
 * refuses a registry entry whose tiles or selector are missing.
 */
export const BACKGROUNDS = [
  { id: "plain", label: "Plain" },
  { id: "diamonds", label: "Diamonds" },
  { id: "leaves", label: "Leaves" },
  { id: "stitches", label: "Stitches" },
  { id: "suns", label: "Suns" },
  { id: "grid", label: "Grid" },
  { id: "rain", label: "Rain" },
  { id: "squares", label: "Squares" },
  { id: "polka", label: "Polka" },
  { id: "basket", label: "Basket" },
  { id: "pebbles", label: "Pebbles" },
  { id: "confetti", label: "Confetti" },
  { id: "petals", label: "Petals" },
  { id: "paws", label: "Paws" },
] as const satisfies readonly Choice[];
export type Background = (typeof BACKGROUNDS)[number]["id"];

/**
 * How an image the user adds fills the page. A pattern repeats, like the
 * built-in tiles; a picture covers the page once. The choice is made when
 * the image is added, because each is stored at its own size.
 */
export const BACKGROUND_FITS = [
  { id: "pattern", label: "Repeating pattern" },
  { id: "picture", label: "Single picture" },
] as const satisfies readonly Choice[];
export type BackgroundFit = (typeof BACKGROUND_FITS)[number]["id"];

/**
 * What a named page is about. A scope limits every section on the page to
 * the notes it admits; "Whole vault" admits all of them, which makes a
 * page of its own sections the vault-wide counterpart of the home page.
 */
export const PAGE_SCOPES = [
  { id: "all", label: "Whole vault", icon: "layout-grid" },
  { id: "folder", label: "Folder", icon: "folder-open" },
  { id: "tag", label: "Tag", icon: "tag" },
  { id: "property", label: "Property", icon: "filter" },
] as const satisfies readonly (Choice & { icon: string })[];
export type PageScopeKind = (typeof PAGE_SCOPES)[number]["id"];

/**
 * How a section's cards show an image from the note, when it has one.
 * See compose/images.ts for where the image comes from.
 */
export const CARD_IMAGES = [
  { id: "none", label: "None" },
  { id: "thumbnail", label: "Thumbnail" },
  { id: "cover", label: "Cover" },
] as const satisfies readonly Choice[];
export type CardImage = (typeof CARD_IMAGES)[number]["id"];

/**
 * The kinds of value a property holds, as Home Cards reads them from the
 * values themselves: Obsidian publishes no API for its property types.
 */
export type ValueType = "text" | "number" | "date" | "boolean" | "list";

/**
 * Condition operators. `types` lists the value types an operator means
 * something for; the section editor offers only those. `input` says what
 * the user types: nothing, a value, a number, or a count of days.
 */
export const CONDITION_OPS = [
  { id: "is", label: "is", types: ["text", "number", "date", "boolean", "list"], input: "value" },
  { id: "is-not", label: "is not", types: ["text", "number", "date", "boolean", "list"], input: "value" },
  { id: "gt", label: "is more than", types: ["number"], input: "number" },
  { id: "gte", label: "is at least", types: ["number"], input: "number" },
  { id: "lt", label: "is less than", types: ["number"], input: "number" },
  { id: "lte", label: "is at most", types: ["number"], input: "number" },
  { id: "today", label: "is today", types: ["date"], input: "none" },
  { id: "before-today", label: "is before today", types: ["date"], input: "none" },
  { id: "after-today", label: "is after today", types: ["date"], input: "none" },
  { id: "next-days", label: "is in the next", types: ["date"], input: "days" },
  { id: "last-days", label: "is in the last", types: ["date"], input: "days" },
  { id: "older-days", label: "is older than", types: ["date"], input: "days" },
  { id: "exists", label: "has a value", types: ["text", "number", "date", "boolean", "list"], input: "none" },
  { id: "missing", label: "is empty", types: ["text", "number", "date", "boolean", "list"], input: "none" },
] as const satisfies readonly (Choice & { types: readonly ValueType[]; input: "value" | "number" | "days" | "none" })[];
export type ConditionOp = (typeof CONDITION_OPS)[number]["id"];

/**
 * Fields every note has, named as Bases names them. A condition or a card
 * field may use one wherever it may use a property.
 */
export const FILE_FIELDS = [
  { id: "file.ctime", label: "Created", type: "date" },
  { id: "file.mtime", label: "Modified", type: "date" },
] as const satisfies readonly (Choice & { type: ValueType })[];

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
  /** `rediscover` sections: how notes are chosen. */
  strategy: RediscoverStrategy;
  /** Include-filters in Notebook Navigator's idiom; see compose/scope.ts. */
  filterTags: string;
  filterProps: string;
  filterFolders: string;
  /** Typed conditions, all of which a note must meet; see compose/conditions.ts. */
  conditions: Condition[];
  /**
   * Properties or file fields the cards show in their footer, in order;
   * empty keeps the page-wide footer. See compose/projection.ts.
   */
  fields: string[];
  image: CardImage;
}

/**
 * One typed test of a property or file field. A condition without a
 * property, or with a value its operator cannot read, tests nothing: the
 * section ignores it, as it ignores a blank filter.
 */
export interface Condition {
  /** A frontmatter key, or a FILE_FIELDS id such as `file.mtime`. */
  property: string;
  op: ConditionOp;
  /** The value or number of days, as typed; unused by some operators. */
  value: string;
}

/**
 * An image the user added as a page background. The image itself sits in
 * the plugin's own folder (see render/backgrounds.ts); settings hold only
 * this record of it.
 */
export interface CustomBackground {
  /** Starts with `custom-`; never collides with a built-in id. */
  id: string;
  label: string;
  /** File name inside the plugin's backgrounds folder; no path. */
  file: string;
  fit: BackgroundFit;
  /** Pixel width of the stored image; a pattern draws at half of it. */
  width: number;
  /** Percent of the theme's background laid over the image. */
  fade: number;
}

/**
 * The notes a page is about. Every field is kept whichever kind is chosen,
 * so switching kinds in the editor does not discard what was typed. A kind
 * whose field is blank admits every note.
 */
export interface PageScope {
  kind: PageScopeKind;
  /** `folder`: vault path, no leading or trailing slash; the subtree counts. */
  folder: string;
  /** `tag`: the tag without its `#`; descendants count. */
  tag: string;
  /** `property`: the frontmatter key a note must have... */
  propertyKey: string;
  /** ...and, when set, the value it must hold. */
  propertyValue: string;
}

/**
 * A page the user named and saved. It opens in a tab of its own, from the
 * command palette, from the page picker, or from an `obsidian://` link.
 */
export interface NamedPage {
  /** Stable; keys the page's tab, its command and its folded sections. */
  id: string;
  /** Shown as the page's title and tab, and used in `obsidian://` links. */
  name: string;
  scope: PageScope;
  /** The page's own sections; null shows the home page's. */
  sections: SectionConfig[] | null;
}

/**
 * Home Cards' own marks on notes: how it presents them, never facts about
 * them. They live in data.json, not in the notes, so pinning or snoozing
 * a card leaves the note untouched. Paths follow renames and leave with
 * deletions (see main.ts and compose/marks.ts).
 */
export interface NoteMarks {
  /** Pinned note paths, the latest pin first. */
  pinned: string[];
  /** Snoozed note paths, each with the local date it returns on (YYYY-MM-DD). */
  snoozed: Record<string, string>;
  /** Notes Rediscover passes over. */
  quiet: string[];
}

export function emptyMarks(): NoteMarks {
  return { pinned: [], snoozed: {}, quiet: [] };
}

/**
 * The shape of data.json this build writes. normalize.ts reads every older
 * shape; the number lets a future migration tell shapes apart without
 * guessing from keys. 1 is every release before the number was stored.
 */
export const SETTINGS_VERSION = 2;

export interface HomeCardsSettings {
  version: number;
  sections: SectionConfig[];
  pages: NamedPage[];
  marks: NoteMarks;
  dedupe: boolean;
  /** Rediscover draws from notes untouched for at least this many months. */
  rediscoverMonths: number;

  greetingEnabled: boolean;
  /** Pin the greeting on fixed-date holidays (New Year, Christmas...). */
  greetingOccasions: boolean;
  greetingName: string;
  showNoteCount: boolean;
  openOnStartup: boolean;

  defaultView: ViewMode;
  cardMinWidth: number;
  cardSurface: Surface;
  /** A built-in `Background` id, or the id of a custom background. */
  background: string;
  customBackgrounds: CustomBackground[];
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

  /**
   * Properties that name a card's image, in order of preference, before
   * the note's first embedded image. Comma separated.
   */
  imageProperties: string;
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
export const BLANK_SECTION: Readonly<Omit<SectionConfig, "conditions" | "fields">> & {
  readonly conditions: readonly Condition[];
  readonly fields: readonly string[];
} =
  Object.freeze({
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
  strategy: "forgotten",
  filterTags: "",
  filterProps: "",
  filterFolders: "",
  conditions: Object.freeze([]),
  fields: Object.freeze([]),
  image: "none",
});

/**
 * The first-run page. Every section works in any vault, so a new user
 * sees cards before configuring anything; property and tag sections
 * need keys only the user knows.
 */
/**
 * A fresh section: BLANK_SECTION with an id and any overrides, holding
 * arrays of its own. Spreading BLANK_SECTION directly would share its
 * condition list between every section made from it.
 */
export function blankSection(over: Partial<SectionConfig> & { id: string }): SectionConfig {
  return { ...BLANK_SECTION, conditions: [], fields: [], ...over };
}

/** A copy of a section that shares nothing with it, under a new id. */
export function copySection(cfg: SectionConfig, id: string): SectionConfig {
  return { ...cfg, id, conditions: cfg.conditions.map((c) => ({ ...c })), fields: [...cfg.fields] };
}

export function defaultSections(): SectionConfig[] {
  return [
    blankSection({ id: "opened", kind: "recent-opened" }),
    blankSection({ id: "created", kind: "recent-created" }),
    blankSection({ id: "most", kind: "most-linked" }),
    blankSection({ id: "least", kind: "least-linked" }),
  ];
}

export function defaultSettings(): HomeCardsSettings {
  return {
    version: SETTINGS_VERSION,
    sections: defaultSections(),
    pages: [],
    marks: emptyMarks(),
    dedupe: true,
    rediscoverMonths: 6,

    greetingEnabled: true,
    greetingOccasions: true,
    greetingName: "",
    showNoteCount: true,
    openOnStartup: false,

    defaultView: "grid",
    cardMinWidth: 262,
    cardSurface: "flat",
    background: "plain",
    customBackgrounds: [],
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

    imageProperties: "cover, image",
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
  rediscoverMonths: { min: 1, max: 36 },
  /** Percent of the theme background over a custom image. */
  fade: { min: 0, max: 95 },
  /** Marks kept, by kind; the oldest go first. */
  pinned: { max: 100 },
  snoozed: { max: 500 },
  quiet: { max: 1000 },
  /** Footer fields per section. */
  fields: { max: 3 },
  /** Conditions per section. */
  conditions: { max: 8 },
  /** Each page adds a command, so the list stays short. */
  pages: { max: 50 },
  pageName: { max: 60 },
} as const;

/** A scope that admits every note. */
export function blankScope(): PageScope {
  return { kind: "all", folder: "", tag: "", propertyKey: "", propertyValue: "" };
}

export function newPageId(): string {
  return `page-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

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
    case "rediscover":
      return cfg.strategy === "forgotten" ? labelOf(SECTION_KINDS, cfg.kind) : labelOf(REDISCOVER_STRATEGIES, cfg.strategy);
    default:
      return labelOf(SECTION_KINDS, cfg.kind);
  }
}

export function sectionTitle(cfg: SectionConfig): string {
  return cfg.title.trim() || autoTitle(cfg);
}
