/**
 * The section editor: one section's source, size, filters and sort, in a
 * modal opened from its row in the settings tab.
 *
 * Edits apply as they are made: a keystroke or slider tick calls the
 * plugin's `touch()`, which saves once the edits stop and redraws open
 * home pages, so the page behind the modal follows along. A change that
 * adds or removes fields (a new source or property) redraws the modal.
 * Closing it hands control back to the tab, which redraws the row.
 */

import { Modal, Setting } from "obsidian";
import { discoverPropertyTypes } from "../compose/vault";
import type HomeCardsPlugin from "../main";
import {
  autoTitle,
  CARD_IMAGES,
  FILE_FIELDS,
  isChoice,
  isGenerated,
  needsRelate,
  REDISCOVER_STRATEGIES,
  LIMITS,
  SECTION_KINDS,
  sectionTitle,
  type SectionConfig,
  type SectionKind,
  type ValueType,
} from "../settings/schema";
import { renderConditionList } from "./condition-list";
import { addChoices } from "./widgets";

/** What a source draws on, where that is not obvious from its name. */
const SOURCE_NOTES: Partial<Record<SectionKind, string>> = {
  pinned: "Notes you pin from a card's menu, the latest pin first. A Pinned section always leads the page, and it stays hidden while you have no pins.",
  continue: "Your latest work session on this device, then notes edited during it, then the session before.",
  related: "Notes linked to what you opened most recently, or sharing links or tags with it.",
  "recent-opened": "Notes opened on this device, the latest first.",
  relate: "Notes from a search in the Relate plugin, which reads relationships, chains of links and dates. Each card says why it matches.",
};

/** Free-text section fields bound by the same kind of row. */
type TextKey = "propertyValue" | "tag" | "filterTags" | "filterProps" | "filterFolders" | "query";

export class SectionModal extends Modal {
  /** Frontmatter keys and their types, gathered once per opening: the walk is vault-wide. */
  private types: ReadonlyMap<string, ValueType> = new Map();
  private properties: readonly string[] = [];

  constructor(
    private readonly plugin: HomeCardsPlugin,
    private readonly cfg: SectionConfig,
    private readonly onDone: () => void
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.types = discoverPropertyTypes(this.app);
    this.properties = [...this.types.keys()];
    this.modalEl.addClass("hc-section-modal");
    this.draw();
  }

  onClose(): void {
    this.contentEl.empty();
    this.onDone();
  }

  /** Draw every field for the current source. */
  private draw(): void {
    const { cfg, contentEl } = this;
    contentEl.empty();
    this.setTitle(sectionTitle(cfg));

    // The heading's placeholder and the modal title follow the fields
    // they derive from as those are typed into.
    let heading: { setPlaceholder(text: string): unknown } | null = null;
    const touch = () => {
      this.setTitle(sectionTitle(cfg));
      heading?.setPlaceholder(autoTitle(cfg));
      this.plugin.touch();
    };
    const redraw = () => {
      this.plugin.touch();
      this.draw();
    };
    const row = (name: string, desc?: string) => {
      const setting = new Setting(contentEl).setName(name);
      if (desc) setting.setDesc(desc);
      return setting;
    };
    const text = (name: string, desc: string, placeholder: string, key: TextKey) =>
      row(name, desc).addText((t) =>
        t
          .setPlaceholder(placeholder)
          .setValue(cfg[key])
          .onChange((v) => {
            cfg[key] = v;
            touch();
          })
      );

    row("Heading", "Leave empty to follow the source.").addText((t) =>
      (heading = t)
        .setPlaceholder(autoTitle(cfg))
        .setValue(cfg.title)
        .onChange((v) => {
          cfg.title = v;
          touch();
        })
    );

    // Sources that need Relate appear while it runs, or when this section
    // already uses one; sources for a note's page never appear.
    const relate = this.plugin.relate !== null;
    const offered = <T extends { readonly id: string }>(list: readonly T[], current: string) =>
      list.filter((k) => (relate || k.id === current || !needsRelate(k)));
    const kinds = offered(SECTION_KINDS, cfg.kind).filter((k) => k.id === cfg.kind || !isGenerated(k.id));
    row("Source", SOURCE_NOTES[cfg.kind] ?? "").addDropdown((d) =>
      addChoices(d, kinds)
        .setValue(cfg.kind)
        .onChange((v) => {
          if (!isChoice(SECTION_KINDS, v)) return;
          cfg.kind = v;
          redraw();
        })
    );

    row("Cards", "How many the section shows before See more.").addSlider((sl) =>
      sl
        .setLimits(LIMITS.count.min, LIMITS.count.max, 1)
        .setValue(cfg.count)
        .onChange((v) => {
          cfg.count = v;
          touch();
        })
    );

    if (cfg.kind === "rediscover") {
      const strategy = REDISCOVER_STRATEGIES.find((st) => st.id === cfg.strategy);
      row("Strategy", strategy?.desc ?? "").addDropdown((d) =>
        addChoices(d, offered(REDISCOVER_STRATEGIES, cfg.strategy))
          .setValue(cfg.strategy)
          .onChange((v) => {
            if (!isChoice(REDISCOVER_STRATEGIES, v)) return;
            cfg.strategy = v;
            redraw();
          })
      );
    }

    if (cfg.kind === "property") {
      const desc = this.properties.length
        ? "Only notes with this property appear here."
        : "The notes in this vault have no properties yet.";
      row("Property", desc).addDropdown((d) => {
        this.propertyOptions(d.addOption("", "Pick a property"), cfg.propertyKey);
        d.setValue(cfg.propertyKey).onChange((v) => {
          cfg.propertyKey = v;
          if (!cfg.sortKey) cfg.sortKey = v;
          redraw();
        });
      });
      text("Value", "Optional. Leave empty to include every note with the property.", "Report", "propertyValue");
    }

    if (cfg.kind === "relate") {
      text(
        "Search",
        relate ? "Any search Relate understands." : "Relate is not running, so this section stays empty until it is.",
        "notes of Q3 Plan this week",
        "query"
      );
    }

    if (cfg.kind === "tag") {
      text("Tag", "Matches the tag and any tag nested under it.", "project/active", "tag");
    }

    if (cfg.kind === "property" || cfg.kind === "tag") {
      row("Sort by", "Notes without the property sort by when they last changed.")
        .addDropdown((d) => {
          this.propertyOptions(d.addOption("", "File modified"), cfg.sortKey);
          d.setValue(cfg.sortKey).onChange((v) => {
            cfg.sortKey = v;
            this.plugin.touch();
          });
        })
        .addDropdown((d) =>
          d
            .addOption("desc", "Newest first")
            .addOption("asc", "Oldest first")
            .setValue(cfg.sortDir)
            .onChange((v) => {
              cfg.sortDir = v === "asc" ? "asc" : "desc";
              this.plugin.touch();
            })
        );
    }

    new Setting(contentEl).setName("Filters").setHeading();
    text("Tags", "Comma separated. A tag includes the tags nested under it.", "project/active, reading", "filterTags");
    text("Properties", "A key requires the property; key=value matches its value.", "status=active, author", "filterProps");
    text("Folders", "A pattern with a slash matches a path; anything else matches a folder name.", "/Projects/*, archive", "filterFolders");

    new Setting(contentEl)
      .setName("Conditions")
      .setDesc("A note must meet every condition. Dates count in days from today.")
      .setHeading();
    renderConditionList(contentEl, cfg.conditions, this.types, () => this.plugin.touch(), () => this.draw());

    new Setting(contentEl).setName("Card display").setHeading();
    const fieldsRow = row("Fields", "Shown in each card's footer, in this order. Leave all empty for the page's usual footer.");
    for (let i = 0; i < LIMITS.fields.max; i++) {
      fieldsRow.addDropdown((d) => {
        d.addOption("", "None");
        for (const f of FILE_FIELDS) d.addOption(f.id, f.label);
        this.propertyOptions(d, cfg.fields[i] ?? "");
        d.setValue(cfg.fields[i] ?? "").onChange((v) => {
          const next = [...cfg.fields];
          next[i] = v;
          cfg.fields = next.filter((f, at) => f && next.indexOf(f) === at);
          redraw();
        });
      });
    }
    row("Image", "From the image properties in Settings, or else the note's first embedded image.").addDropdown((d) =>
      addChoices(d, CARD_IMAGES)
        .setValue(cfg.image)
        .onChange((v) => {
          if (!isChoice(CARD_IMAGES, v)) return;
          cfg.image = v;
          this.plugin.touch();
        })
    );
  }

  /** Every vault property, plus a stored key the vault no longer uses. */
  private propertyOptions(d: { addOption(value: string, label: string): unknown }, stored: string): void {
    for (const k of this.properties) d.addOption(k, k);
    const known = this.properties.includes(stored) || FILE_FIELDS.some((f) => f.id === stored);
    if (stored && !known) d.addOption(stored, `${stored} (not in vault)`);
  }
}
