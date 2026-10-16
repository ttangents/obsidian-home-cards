/**
 * The settings for one folder page, in a modal opened from the page's
 * header or from the Folder pages list.
 *
 * Without sections of their own, a folder page shows the home page's
 * sections, limited to the folder. The toggle here gives the folder a copy
 * of those sections to change freely. Turning it off puts the folder back
 * on the home page's list; the copy is kept until the modal closes, so
 * flipping the toggle by mistake costs nothing.
 *
 * Edits apply as they are made, as in the section editor: each calls the
 * plugin's `touch()`, which saves once the edits stop and redraws open
 * pages.
 */

import { Modal, Setting } from "obsidian";
import type HomeCardsPlugin from "../main";
import { cloneSections, findFolderPage, folderName } from "../settings/folder-pages";
import { BLANK_SECTION, newSectionId, sectionTitle, type FolderPage, type SectionConfig } from "../settings/schema";
import { SectionModal } from "./section-modal";
import { sectionSummary } from "./widgets";

export class FolderPageModal extends Modal {
  /** The folder's own sections, set aside while the toggle is off. */
  private stash: SectionConfig[] | null = null;

  constructor(
    private readonly plugin: HomeCardsPlugin,
    private readonly folder: string,
    private readonly onDone: () => void
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.modalEl.addClass("hc-section-modal");
    this.draw();
  }

  onClose(): void {
    // A page whose last section was deleted would otherwise show nothing;
    // with no entry, the folder follows the home page again.
    const page = this.page();
    if (page && !page.sections.length) {
      this.dropPage(page);
      this.plugin.touch();
    }
    this.contentEl.empty();
    this.onDone();
  }

  private dropPage(page: FolderPage): void {
    const pages = this.plugin.settings.folderPages;
    pages.splice(pages.indexOf(page), 1);
  }

  private page(): FolderPage | undefined {
    return findFolderPage(this.plugin.settings.folderPages, this.folder);
  }

  private draw(): void {
    const { contentEl, plugin } = this;
    contentEl.empty();
    this.setTitle(`${folderName(this.folder)} page`);
    const page = this.page();

    new Setting(contentEl)
      .setName("Own sections")
      .setDesc(
        page
          ? "This folder's page uses the sections below, not the home page's."
          : `This folder's page shows the home page's sections, limited to ${this.folder}. Turn this on to give it sections of its own.`
      )
      .addToggle((t) => t.setValue(page !== undefined).onChange((on) => this.setOwn(on)));
    if (!page) return;

    new Setting(contentEl).setName("Sections").setHeading();
    const { sections } = page;
    sections.forEach((cfg, i) => {
      new Setting(contentEl)
        .setName(sectionTitle(cfg))
        .setDesc(sectionSummary(cfg))
        .addToggle((t) =>
          t
            .setTooltip("Show this section")
            .setValue(cfg.enabled)
            .onChange((on) => {
              cfg.enabled = on;
              plugin.touch();
            })
        )
        .addExtraButton((b) =>
          b.setIcon("arrow-up").setTooltip("Move up").setDisabled(i === 0).onClick(() => this.move(sections, i, -1))
        )
        .addExtraButton((b) =>
          b
            .setIcon("arrow-down")
            .setTooltip("Move down")
            .setDisabled(i === sections.length - 1)
            .onClick(() => this.move(sections, i, 1))
        )
        .addExtraButton((b) =>
          b.setIcon("pencil").setTooltip("Edit section").onClick(() => this.edit(cfg))
        )
        .addExtraButton((b) =>
          b.setIcon("trash").setTooltip("Delete section").onClick(() => {
            sections.splice(i, 1);
            plugin.touch();
            this.draw();
          })
        );
    });
    new Setting(contentEl).addButton((b) =>
      b.setButtonText("Add section").onClick(() => {
        const cfg: SectionConfig = { ...BLANK_SECTION, id: newSectionId() };
        sections.push(cfg);
        plugin.touch();
        this.draw();
        this.edit(cfg);
      })
    );
  }

  /** Give the folder its own sections, or return it to the home page's. */
  private setOwn(on: boolean): void {
    const { settings } = this.plugin;
    if (on) {
      settings.folderPages.push({
        path: this.folder,
        sections: this.stash ?? cloneSections(settings.sections),
      });
    } else {
      const page = this.page();
      if (page) {
        this.stash = page.sections;
        this.dropPage(page);
      }
    }
    this.plugin.touch();
    this.draw();
  }

  private move(sections: SectionConfig[], index: number, by: -1 | 1): void {
    const [moved] = sections.splice(index, 1);
    if (!moved) return;
    sections.splice(index + by, 0, moved);
    this.plugin.touch();
    this.draw();
  }

  private edit(cfg: SectionConfig): void {
    new SectionModal(this.plugin, cfg, () => this.draw()).open();
  }
}
