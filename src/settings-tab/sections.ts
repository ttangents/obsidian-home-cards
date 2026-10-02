/**
 * The Sections pane: the ordered list of sections, each a collapsible
 * editor.
 *
 * Edits follow the plugin's two persistence verbs. A keystroke or slider
 * tick calls `touch()`, which coalesces writes. A change that alters
 * which controls exist (add, remove, reorder, a new source or property)
 * calls `restructure()`, which writes at once and redraws the pane.
 */

import { ExtraButtonComponent, Setting, ToggleComponent } from "obsidian";
import { discoverProperties } from "../compose/vault";
import type HomeCardsPlugin from "../main";
import {
  autoTitle,
  BLANK_SECTION,
  isChoice,
  labelOf,
  LIMITS,
  newSectionId,
  SECTION_KINDS,
  sectionTitle,
  type SectionConfig,
} from "../settings/schema";
import { addChoices, hint, settingGroup } from "./widgets";

export class SectionsPane {
  /** Open editors, by section id. View state: never persisted. */
  private readonly expanded = new Set<string>();
  /**
   * Frontmatter keys, gathered once per visit to the settings tab.
   * `discoverProperties` walks every note, and the pane redraws on each
   * structural edit.
   */
  private properties: string[] | null = null;

  constructor(
    private readonly plugin: HomeCardsPlugin,
    private readonly redraw: () => void
  ) {}

  /** Called when the settings tab closes, so the next visit sees new keys. */
  forget(): void {
    this.properties = null;
  }

  render(root: HTMLElement): void {
    const s = this.plugin.settings;
    hint(
      root,
      "Sections render top to bottom. A note appears in the first section that claims it, so order sets precedence."
    );
    const props = (this.properties ??= discoverProperties(this.plugin.app));
    for (const cfg of s.sections) {
      this.renderSection(settingGroup(root, undefined, "hc-sec-group"), cfg, props);
    }

    const addRow = root.createDiv({ cls: "hc-addrow" });
    addRow.createEl("button", { cls: "mod-cta", text: "Add section" }).addEventListener("click", () => {
      const cfg: SectionConfig = { ...BLANK_SECTION, id: newSectionId() };
      s.sections.push(cfg);
      this.expanded.add(cfg.id);
      void this.restructure();
    });

    new Setting(settingGroup(root))
      .setName("One section per note")
      .setDesc("Stops a note filling a slot in more than one section.")
      .addToggle((t) =>
        t.setValue(s.dedupe).onChange((v) => {
          s.dedupe = v;
          this.plugin.touch();
        })
      );

    new Setting(settingGroup(root))
      .setName("Rediscover notes untouched for")
      .setDesc("In months. Rediscover sections and the shuffle button on the home page draw from these notes.")
      .addSlider((sl) =>
        sl
          .setLimits(LIMITS.rediscoverMonths.min, LIMITS.rediscoverMonths.max, 1)
          .setValue(s.rediscoverMonths)
          .setDynamicTooltip()
          .onChange((v) => {
            s.rediscoverMonths = v;
            this.plugin.touch();
          })
      );
  }

  private async restructure(): Promise<void> {
    await this.plugin.commit();
    this.redraw();
  }

  /**
   * Collapsed: one summary row. Expanded: the same row followed by the
   * editor's rows in the same container, so the group stays one card.
   */
  private renderSection(items: HTMLElement, cfg: SectionConfig, props: readonly string[]): void {
    const sections = this.plugin.settings.sections;
    const open = this.expanded.has(cfg.id);
    // Read at click time: the list may have changed since this row drew.
    const position = () => sections.indexOf(cfg);
    const move = (by: -1 | 1) => {
      const i = position();
      const j = i + by;
      if (i < 0 || j < 0 || j >= sections.length) return;
      [sections[i], sections[j]] = [sections[j], sections[i]];
      void this.restructure();
    };

    // ---- summary row, in Obsidian's own controls
    const head = items.createDiv({ cls: "setting-item hc-sec-head" });
    head.toggleClass("is-off", !cfg.enabled);

    const toggleOpen = () => {
      if (open) this.expanded.delete(cfg.id);
      else this.expanded.add(cfg.id);
      this.redraw();
    };
    new ExtraButtonComponent(head)
      .setIcon(open ? "chevron-down" : "chevron-right")
      .setTooltip(open ? "Collapse" : "Expand")
      .onClick(toggleOpen)
      .extraSettingsEl.addClass("hc-twisty");

    const info = head.createDiv({ cls: "setting-item-info hc-sec-label" });
    info.addEventListener("click", toggleOpen);
    const name = info.createDiv({ cls: "setting-item-name" });
    const meta = info.createDiv({ cls: "setting-item-description" });
    // Heading and summary follow the editor below as it is typed into.
    const paintSummary = () => {
      const derived = !cfg.title.trim();
      name.setText(sectionTitle(cfg));
      name.toggleClass("is-derived", derived);
      const cards = `${cfg.count} ${cfg.count === 1 ? "card" : "cards"}`;
      meta.setText(derived ? cards : `${labelOf(SECTION_KINDS, cfg.kind)} · ${cards}`);
    };
    paintSummary();

    const controls = head.createDiv({ cls: "setting-item-control" });
    new ToggleComponent(controls)
      .setValue(cfg.enabled)
      .setTooltip("Show this section")
      .onChange((on) => {
        cfg.enabled = on;
        head.toggleClass("is-off", !on);
        this.plugin.touch();
      });

    const index = position();
    const button = (icon: string, label: string, disabled: boolean, action: () => void) =>
      new ExtraButtonComponent(controls)
        .setIcon(icon)
        .setTooltip(label)
        .setDisabled(disabled)
        .onClick(action);
    button("arrow-up", "Move up", index === 0, () => move(-1));
    button("arrow-down", "Move down", index === sections.length - 1, () => move(1));
    button("trash-2", "Remove section", false, () => {
      const i = position();
      if (i < 0) return;
      sections.splice(i, 1);
      this.expanded.delete(cfg.id);
      void this.restructure();
    });

    if (open) this.renderEditor(items, cfg, props, paintSummary);
  }

  private renderEditor(
    items: HTMLElement,
    cfg: SectionConfig,
    props: readonly string[],
    paintSummary: () => void
  ): void {
    const touch = () => {
      paintSummary();
      this.plugin.touch();
    };
    const row = (name: string, desc?: string) => {
      const setting = new Setting(items).setName(name).setClass("hc-subrow");
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
      t
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
          void this.restructure();
        })
    );

    row("Cards").addSlider((sl) =>
      sl
        .setLimits(LIMITS.count.min, LIMITS.count.max, 1)
        .setValue(cfg.count)
        .setDynamicTooltip()
        .onChange((v) => {
          cfg.count = v;
          touch();
        })
    );

    if (cfg.kind === "property") {
      const desc = props.length
        ? "Only notes carrying it appear here."
        : "The notes in this vault have no properties yet. Add some, then reopen settings.";
      row("Property", desc).addDropdown((d) => {
        d.addOption("", "Pick a property");
        for (const k of props) d.addOption(k, k);
        // A stored key the vault no longer uses stays selectable and labeled.
        if (cfg.propertyKey && !props.includes(cfg.propertyKey)) {
          d.addOption(cfg.propertyKey, `${cfg.propertyKey} (not in vault)`);
        }
        d.setValue(cfg.propertyKey).onChange((v) => {
          cfg.propertyKey = v;
          if (!cfg.sortKey) cfg.sortKey = v;
          void this.restructure();
        });
      });
      text("Value", "Optional. Empty includes every note with the property.", "e.g. Report", "propertyValue");
    }

    if (cfg.kind === "tag") {
      text("Tag", "Matches the tag and anything nested under it.", "my/deliverable", "tag");
    }

    text("Filter by tag", "Comma separated. Bare tags include descendants.", "firm/vendor*, my/deliverable", "filterTags");
    text("Filter by property", "`key` requires the property; `key=value` matches it.", "type=Organization, status", "filterProps");
    text("Filter by folder", "Path patterns with /, otherwise folder names.", "/Stuff/*, interviews", "filterFolders");

    if (cfg.kind === "property" || cfg.kind === "tag") {
      row("Sort by", "Notes without the property fall back to file modification time.")
        .addDropdown((d) => {
          d.addOption("", "File modified");
          for (const k of props) d.addOption(k, k);
          if (cfg.sortKey && !props.includes(cfg.sortKey)) {
            d.addOption(cfg.sortKey, `${cfg.sortKey} (not in vault)`);
          }
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
  }
}

/** Free-text section fields the editor binds with the same control. */
type TextKey = "propertyValue" | "tag" | "filterTags" | "filterProps" | "filterFolders";
