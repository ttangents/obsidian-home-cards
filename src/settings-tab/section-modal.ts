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
import { autoTitle, isChoice, LIMITS, SECTION_KINDS, sectionTitle, type SectionConfig, type ValueType } from "../settings/schema";
import { renderConditionList } from "./condition-list";
import { addChoices } from "./widgets";

/** Free-text section fields bound by the same kind of row. */
type TextKey = "propertyValue" | "tag" | "filterTags" | "filterProps" | "filterFolders";

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

    row("Source").addDropdown((d) =>
      addChoices(d, SECTION_KINDS)
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
  }

  /** Every vault property, plus a stored key the vault no longer uses. */
  private propertyOptions(d: { addOption(value: string, label: string): unknown }, stored: string): void {
    for (const k of this.properties) d.addOption(k, k);
    if (stored && !this.properties.includes(stored)) d.addOption(stored, `${stored} (not in vault)`);
  }
}
