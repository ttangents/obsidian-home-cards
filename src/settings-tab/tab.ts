/**
 * The settings tab, declared through Obsidian's settings definitions
 * (1.13+), so Obsidian draws every row in its own style and lists each
 * setting in its settings search.
 *
 * Controls bind to settings keys. `getControlValue` and `setControlValue`
 * route every read and write through this tab: writes go through the
 * plugin's `touch()`, which saves once a burst of edits stops and redraws
 * open views. One key is virtual: the glyph dropdown (`GLYPH`) stands
 * for two stored flags.
 *
 * Sections are a list: each row carries its visibility toggle, an edit
 * button that opens the section editor, a delete button and a drag
 * handle. Obsidian draws the last two for every row of a list. Folder
 * pages with sections of their own, and the images added as backgrounds,
 * are lists too.
 */

import { PluginSettingTab, type Setting, type SettingDefinitionItem } from "obsidian";
import type HomeCardsPlugin from "../main";
import { backgroundExists, chooseImage, removeBackground } from "../render/backgrounds";
import { pickFolder } from "../render/folder-picker";
import { renderBackgroundPicker } from "../render/swatches";
import { cloneSections } from "../settings/folder-pages";
import {
  BACKGROUND_FITS,
  BLANK_SECTION,
  defaultSettings,
  isChoice,
  labelOf,
  LIMITS,
  newSectionId,
  sectionTitle,
  SURFACES,
  VIEW_MODES,
  type HomeCardsSettings,
  type SectionConfig,
} from "../settings/schema";
import { BackgroundModal } from "./background-modal";
import { FolderPageModal } from "./folder-page-modal";
import { SectionModal } from "./section-modal";
import { choiceOptions, sectionSummary } from "./widgets";

/** Settings the tab keeps in lists and editors of their own, not in a control. */
const COLLECTIONS = ["sections", "folderPages", "customBackgrounds"] as const;

/** Settings a control binds to directly. */
type ScalarKey = Exclude<keyof HomeCardsSettings, (typeof COLLECTIONS)[number]>;

const DEFAULTS = defaultSettings();

/** Dropdown keys, with the registry each value must belong to. */
const CHOICES = {
  defaultView: VIEW_MODES,
  cardSurface: SURFACES,
} as const;

/**
 * Text fields whose stored form differs from what is typed: trimmed, and
 * an empty entry falls back to the default rather than storing nothing.
 */
const TEXT_RULES: Partial<Record<ScalarKey, (typed: string) => string>> = {
  typeProperty: (v) => v.trim() || DEFAULTS.typeProperty,
  summaryProperty: (v) => v.trim(),
};

/** The glyph dropdown stands for two stored flags. */
const GLYPH = "glyph";
const GLYPH_OPTIONS = { off: "None", letter: "Initial letter", typify: "Icon from Typify" };

export class HomeCardsSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: HomeCardsPlugin) {
    super(plugin.app, plugin);
  }

  /** Obsidian calls this when the tab closes: write any pending edit. */
  hide(): void {
    super.hide();
    void this.plugin.flush();
  }

  // ------------------------------------------------------------ bindings

  getControlValue(key: string): unknown {
    const s = this.plugin.settings;
    if (key === GLYPH) return !s.showGlyph ? "off" : s.typifyIcons ? "typify" : "letter";
    return isScalarKey(key) ? s[key] : undefined;
  }

  setControlValue(key: string, value: unknown): void {
    const s = this.plugin.settings;
    if (key === GLYPH) {
      s.showGlyph = value !== "off";
      s.typifyIcons = value === "typify";
    } else if (isScalarKey(key)) {
      const next = coerce(key, value, s[key]);
      if (next === undefined) return;
      (s as unknown as Record<ScalarKey, unknown>)[key] = next;
    } else {
      return;
    }
    this.plugin.touch();
    // Rows that show or hide with this value re-check their predicates.
    this.refreshDomState();
  }

  // --------------------------------------------------------- definitions

  /**
   * Called on every redraw and once at startup for the search index, so
   * it only describes rows; the vault-wide work (the property list for
   * the section editor) waits until a row is drawn or a modal opens.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    const s = this.plugin.settings;
    return [
      ...this.general(),
      this.sectionList(s),
      this.folderList(s),
      this.cardsGroup(s),
      this.textGroup(),
      this.appearanceGroup(),
      this.backgroundList(s),
      this.headerGroup(s),
    ];
  }

  private general(): SettingDefinitionItem[] {
    return [
      {
        name: "Open on startup",
        desc: "Show the home page when Obsidian opens.",
        control: { type: "toggle", key: "openOnStartup" },
      },
      {
        name: "Default view",
        desc: "The layout the home page opens in. The header switches it for the current page.",
        control: { type: "dropdown", key: "defaultView", options: choiceOptions(VIEW_MODES) },
      },
      {
        name: "One section per note",
        desc: "Show each note only in the first section that claims it, so section order sets precedence.",
        control: { type: "toggle", key: "dedupe" },
      },
      {
        name: "Rediscover notes untouched for",
        desc: "In months. Rediscover sections and the shuffle button draw from these notes.",
        aliases: ["random note", "forgotten notes"],
        control: {
          type: "slider",
          key: "rediscoverMonths",
          min: LIMITS.rediscoverMonths.min,
          max: LIMITS.rediscoverMonths.max,
          step: 1,
        },
      },
    ];
  }

  /**
   * One row per section, in page order. Obsidian adds the delete button
   * and drag handle; each row adds its toggle and edit button. Callbacks
   * look the section up by its id, which survives reordering.
   */
  private sectionList(s: HomeCardsSettings): SettingDefinitionItem {
    const find = (id: string) => this.plugin.settings.sections.find((c) => c.id === id);
    return {
      type: "list",
      heading: "Sections",
      emptyState: "No sections. Add one to fill the home page.",
      addItem: {
        name: "Add section",
        action: () => {
          const cfg: SectionConfig = { ...BLANK_SECTION, id: newSectionId() };
          this.plugin.settings.sections.push(cfg);
          void this.restructure();
          this.editSection(cfg.id);
        },
      },
      onReorder: (from, to) => {
        const list = this.plugin.settings.sections;
        const [moved] = list.splice(from, 1);
        if (moved) list.splice(to, 0, moved);
        void this.restructure();
      },
      onDelete: (index) => {
        this.plugin.settings.sections.splice(index, 1);
        void this.restructure();
      },
      items: s.sections.map((cfg) => ({
        name: sectionTitle(cfg),
        desc: sectionSummary(cfg),
        searchable: false,
        render: (setting: Setting) => {
          setting
            .addToggle((t) =>
              t
                .setTooltip("Show this section")
                .setValue(cfg.enabled)
                .onChange((on) => {
                  const live = find(cfg.id);
                  if (!live) return;
                  live.enabled = on;
                  this.plugin.touch();
                })
            )
            .addExtraButton((b) =>
              b
                .setIcon("pencil")
                .setTooltip("Edit section")
                .onClick(() => this.editSection(cfg.id))
            );
        },
      })),
    };
  }

  /**
   * Folders with sections of their own. Every other folder still opens a
   * page, with the sections above limited to it, so this list holds only
   * the exceptions.
   */
  private folderList(s: HomeCardsSettings): SettingDefinitionItem {
    const { app } = this.plugin;
    return {
      type: "list",
      heading: "Folder pages",
      emptyState:
        "No folder has sections of its own. A folder's page shows the sections above, limited to that folder.",
      addItem: {
        name: "Add folder page",
        action: () =>
          pickFolder(
            app,
            (folder) => {
              const settings = this.plugin.settings;
              settings.folderPages.push({ path: folder.path, sections: cloneSections(settings.sections) });
              void this.restructure();
              this.editFolderPage(folder.path);
            },
            new Set(s.folderPages.map((page) => page.path))
          ),
      },
      onDelete: (index) => {
        this.plugin.settings.folderPages.splice(index, 1);
        void this.restructure();
      },
      items: s.folderPages.map((page) => {
        const count = `${page.sections.length} ${page.sections.length === 1 ? "section" : "sections"}`;
        return {
          name: page.path,
          desc: app.vault.getFolderByPath(page.path) ? count : `${count} · folder not found`,
          searchable: false,
          render: (setting: Setting) => {
            setting
              .addExtraButton((b) =>
                b
                  .setIcon("layout-grid")
                  .setTooltip("Open page")
                  .onClick(() => void this.plugin.activateView(page.path))
              )
              .addExtraButton((b) =>
                b.setIcon("pencil").setTooltip("Edit page").onClick(() => this.editFolderPage(page.path))
              );
          },
        };
      }),
    };
  }

  private cardsGroup(s: HomeCardsSettings): SettingDefinitionItem {
    return {
      type: "group",
      heading: "Cards",
      items: [
        {
          name: "Glyph",
          desc: "A mark in the corner of each card. Typify icons need the Typify plugin; types without one keep the letter.",
          control: { type: "dropdown", key: GLYPH, options: GLYPH_OPTIONS },
        },
        {
          name: "Type label",
          desc: "Show the note's type as the first pill on each card.",
          control: { type: "toggle", key: "showRubric" },
        },
        {
          name: "Type property",
          desc: "The property that holds each note's type.",
          control: { type: "text", key: "typeProperty", placeholder: DEFAULTS.typeProperty },
          visible: () => s.showRubric,
        },
        {
          name: "Type label in accent color",
          desc: "Off uses the theme's muted text color.",
          control: { type: "toggle", key: "accentRubrics" },
          visible: () => s.showRubric,
        },
        {
          name: "Tags",
          desc: "Frontmatter tags first, then inline tags.",
          control: { type: "toggle", key: "showTags" },
        },
        {
          name: "Tags per card",
          control: { type: "slider", key: "maxTags", min: LIMITS.maxTags.min, max: LIMITS.maxTags.max, step: 1 },
          visible: () => s.showTags,
        },
        {
          name: "Opening sentence",
          desc: "The note's first sentence of prose, or its summary property.",
          control: { type: "toggle", key: "showDeks" },
        },
        {
          name: "Lines of the opening sentence",
          control: { type: "slider", key: "dekLines", min: LIMITS.dekLines.min, max: LIMITS.dekLines.max, step: 1 },
          visible: () => s.showDeks,
        },
        {
          name: "File size in the footer",
          desc: "The footer always shows the value the section sorts on.",
          control: { type: "toggle", key: "showFileSize" },
        },
      ],
    };
  }

  private textGroup(): SettingDefinitionItem {
    return {
      type: "group",
      heading: "Card text",
      items: [
        {
          name: "Summary property",
          desc: "When a note has this property, its value replaces the opening sentence.",
          control: { type: "text", key: "summaryProperty", placeholder: "summary" },
        },
        {
          name: "Skip openings that begin with",
          desc: "Comma separated. Home Cards passes over a first sentence that starts with one of these.",
          control: { type: "text", key: "boilerplateOpeners", placeholder: "this note, this page" },
        },
        {
          name: "Remove from titles",
          desc: "Comma separated prefixes to drop from card titles.",
          control: { type: "text", key: "titlePrefixes", placeholder: "(Draft)" },
        },
        {
          name: "Remove trailing dates from titles",
          desc: "Drops a date stamp at the end of a title, such as 2026-10-14.",
          control: { type: "toggle", key: "stripTrailingDates" },
        },
      ],
    };
  }

  private appearanceGroup(): SettingDefinitionItem {
    return {
      type: "group",
      heading: "Appearance",
      items: [
        {
          name: "Minimum card width",
          desc: "Cards reflow to fill the page; this sets how narrow they may get.",
          control: {
            type: "slider",
            key: "cardMinWidth",
            min: LIMITS.cardMinWidth.min,
            max: LIMITS.cardMinWidth.max,
            step: 2,
            displayFormat: (v) => `${v}px`,
          },
        },
        {
          name: "Card surface",
          desc: "Flat uses the theme's panel color and a thin border. Elevated lifts each card on a shadow. Frosted lets a background pattern show through, blurred.",
          control: { type: "dropdown", key: "cardSurface", options: choiceOptions(SURFACES) },
        },
        {
          name: "Background",
          desc: "Plain follows the theme. Each pattern has a light and a dark version that follow the theme's mode.",
          aliases: ["pattern", "wallpaper"],
          render: (setting: Setting) => {
            setting.settingEl.addClass("hc-picker-row");
            // A redraw of the tab can render this row into the element it
            // already filled; clear the old grid so there is only ever one.
            setting.settingEl.findAll(".hc-swatches").forEach((grid) => grid.remove());
            renderBackgroundPicker(setting.settingEl, this.plugin);
          },
        },
      ],
    };
  }

  /**
   * Images the user added as backgrounds. Their files live in the
   * plugin's own folder; deleting a row deletes its file.
   */
  private backgroundList(s: HomeCardsSettings): SettingDefinitionItem {
    return {
      type: "list",
      heading: "Your backgrounds",
      emptyState:
        "Add a PNG, JPEG, WebP or GIF to use as the page background. Home Cards keeps a resized copy in its own plugin folder and leaves your vault's files alone.",
      addItem: {
        name: "Add image",
        action: () =>
          chooseImage((file) =>
            new BackgroundModal(this.plugin, { kind: "add", file }, () => void this.restructure()).open()
          ),
      },
      onDelete: (index) => void this.deleteBackground(index),
      items: s.customBackgrounds.map((bg) => ({
        name: bg.label,
        desc: `${labelOf(BACKGROUND_FITS, bg.fit)} · ${bg.fade}% fade`,
        searchable: false,
        render: (setting: Setting) => {
          setting.addExtraButton((b) =>
            b
              .setIcon("pencil")
              .setTooltip("Edit background")
              .onClick(() =>
                new BackgroundModal(
                  this.plugin,
                  { kind: "edit", background: bg },
                  () => void this.restructure()
                ).open()
              )
          );
          // A sync may bring the settings before the image; say so rather than show a blank swatch.
          void backgroundExists(this.plugin, bg).then((found) => {
            if (!found) setting.setDesc("The image file is missing. Remove this entry or add the image again.");
          });
        },
      })),
    };
  }

  private headerGroup(s: HomeCardsSettings): SettingDefinitionItem {
    return {
      type: "group",
      heading: "Header",
      items: [
        {
          name: "Greeting",
          desc: "Follows the time of day and the calendar, with a word from another language now and then.",
          control: { type: "toggle", key: "greetingEnabled" },
        },
        {
          name: "Your name",
          desc: "Some greetings address you by it.",
          control: { type: "text", key: "greetingName", placeholder: "Your name" },
          visible: () => s.greetingEnabled,
        },
        {
          name: "Holiday greetings",
          desc: "Mark fixed-date holidays, such as New Year's Day, from the next time the home page opens.",
          control: { type: "toggle", key: "greetingOccasions" },
          visible: () => s.greetingEnabled,
        },
        {
          name: "Note count",
          desc: "Show how many notes the vault holds, after the date.",
          control: { type: "toggle", key: "showNoteCount" },
        },
      ],
    };
  }

  // ------------------------------------------------------------- actions

  /** Write now and rebuild the rows, for changes to the section list. */
  private async restructure(): Promise<void> {
    await this.plugin.commit();
    this.update();
  }

  /** Remove an added background and its file. */
  private async deleteBackground(index: number): Promise<void> {
    const settings = this.plugin.settings;
    const [bg] = settings.customBackgrounds.splice(index, 1);
    if (!bg) return;
    if (settings.background === bg.id) settings.background = "plain";
    await this.plugin.commit();
    await removeBackground(this.plugin, bg);
    this.update();
  }

  /** Open the editor for one folder page; its row redraws when it closes. */
  private editFolderPage(path: string): void {
    new FolderPageModal(this.plugin, path, () => void this.restructure()).open();
  }

  /** Open the editor for one section; its row redraws when it closes. */
  private editSection(id: string): void {
    const cfg = this.plugin.settings.sections.find((c) => c.id === id);
    if (!cfg) return;
    new SectionModal(this.plugin, cfg, () => void this.restructure()).open();
  }
}

// ----------------------------------------------------------------- helpers

function isScalarKey(key: string): key is ScalarKey {
  return !(COLLECTIONS as readonly string[]).includes(key) && key in DEFAULTS;
}

/**
 * The stored form of a control's value, or undefined to refuse it. The
 * controls only produce values of the right kind; this guards the
 * registries and the text rules.
 */
function coerce(key: ScalarKey, value: unknown, current: unknown): unknown {
  if (key in CHOICES) {
    const registry = CHOICES[key as keyof typeof CHOICES];
    return typeof value === "string" && isChoice(registry, value) ? value : undefined;
  }
  if (typeof value !== typeof current) return undefined;
  const rule = TEXT_RULES[key];
  return rule && typeof value === "string" ? rule(value) : value;
}
