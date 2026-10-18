/**
 * An editable list of sections: toggle, reorder, edit and delete each,
 * and add another. Drawn into a modal for a page's own sections.
 *
 * Every edit calls `changed`, which the caller routes to the plugin's
 * `touch()` or ignores while a draft is unsaved; structural edits then
 * call `redraw`, since the rows must be rebuilt.
 */

import { Setting } from "obsidian";
import type HomeCardsPlugin from "../main";
import { blankSection, newSectionId, sectionTitle, type SectionConfig } from "../settings/schema";
import { SectionModal } from "./section-modal";
import { sectionSummary } from "./widgets";

export function renderSectionList(
  el: HTMLElement,
  plugin: HomeCardsPlugin,
  sections: SectionConfig[],
  changed: () => void,
  redraw: () => void
): void {
  const move = (index: number, by: -1 | 1): void => {
    const [moved] = sections.splice(index, 1);
    if (!moved) return;
    sections.splice(index + by, 0, moved);
    changed();
    redraw();
  };
  const edit = (cfg: SectionConfig): void => {
    new SectionModal(plugin, cfg, redraw).open();
  };

  new Setting(el).setName("Sections").setHeading();
  sections.forEach((cfg, i) => {
    new Setting(el)
      .setName(sectionTitle(cfg))
      .setDesc(sectionSummary(cfg))
      .addToggle((t) =>
        t
          .setTooltip("Show this section")
          .setValue(cfg.enabled)
          .onChange((on) => {
            cfg.enabled = on;
            changed();
          })
      )
      .addExtraButton((b) =>
        b.setIcon("arrow-up").setTooltip("Move up").setDisabled(i === 0).onClick(() => move(i, -1))
      )
      .addExtraButton((b) =>
        b
          .setIcon("arrow-down")
          .setTooltip("Move down")
          .setDisabled(i === sections.length - 1)
          .onClick(() => move(i, 1))
      )
      .addExtraButton((b) => b.setIcon("pencil").setTooltip("Edit section").onClick(() => edit(cfg)))
      .addExtraButton((b) =>
        b.setIcon("trash").setTooltip("Delete section").onClick(() => {
          sections.splice(i, 1);
          changed();
          redraw();
        })
      );
  });
  new Setting(el).addButton((b) =>
    b.setButtonText("Add section").onClick(() => {
      const cfg: SectionConfig = blankSection({ id: newSectionId() });
      sections.push(cfg);
      changed();
      redraw();
      edit(cfg);
    })
  );
}
