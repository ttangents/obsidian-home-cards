/**
 * The editor for one named page: its name, what it is about, and whether
 * it has sections of its own.
 *
 * In "edit" mode every change applies as it is made, as in the section
 * editor: each calls the plugin's `touch()`, which saves once the edits
 * stop and redraws open pages. In "create" mode the page is a draft that
 * joins the settings only when Create page is pressed; closing any other
 * way leaves no trace.
 *
 * Without sections of its own, a page shows the home page's sections,
 * limited to its scope. The toggle gives it a copy of those to change
 * freely. Turning it off puts the page back on the home page's list; the
 * copy is kept until the modal closes, so flipping the toggle by mistake
 * costs nothing.
 */

import { cssClassSetting } from "./widgets";
import { Modal, Notice, Setting } from "obsidian";
import type HomeCardsPlugin from "../main";
import { pickFolder } from "../render/folder-picker";
import { cloneSections } from "../settings/folders";
import { isScopeBlank, suggestPageName, uniquePageName } from "../settings/pages";
import { PAGE_SCOPES, type NamedPage, type PageScopeKind, type SectionConfig } from "../settings/schema";
import { renderSectionList } from "./section-list";

export class PageModal extends Modal {
  /** The page's own sections, set aside while the toggle is off. */
  private stash: SectionConfig[] | null = null;
  private created = false;

  constructor(
    private readonly plugin: HomeCardsPlugin,
    private readonly page: NamedPage,
    private readonly mode: "create" | "edit",
    /** Called when the modal closes, with the page; in create mode, only if it was created. */
    private readonly onDone: (page: NamedPage) => void
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.modalEl.addClass("hc-section-modal");
    this.draw();
  }

  onClose(): void {
    const { page, plugin } = this;
    this.contentEl.empty();
    if (this.mode === "create") {
      if (this.created) this.onDone(page);
      return;
    }
    // A cleared name falls back to one derived from the scope.
    page.name = uniquePageName(plugin.settings.pages, page.name.trim() || suggestPageName(page.scope), page.id);
    plugin.touch();
    this.onDone(page);
  }

  /** Record an edit. A draft is not in the settings yet, so it has nothing to save. */
  private changed(): void {
    if (this.mode === "edit") this.plugin.touch();
  }

  private draw(): void {
    const { contentEl, page } = this;
    contentEl.empty();
    this.setTitle(this.mode === "create" ? "New page" : page.name || "Page");

    new Setting(contentEl)
      .setName("Name")
      .setDesc("Shown as the page's title and tab, and used in links to it.")
      .addText((t) =>
        t
          .setPlaceholder(suggestPageName(page.scope))
          .setValue(page.name)
          .onChange((value) => {
            page.name = value;
            this.changed();
          })
      );

    new Setting(contentEl)
      .setName("About")
      .setDesc("The notes the page shows. Its sections draw only from these.")
      .addDropdown((d) => {
        for (const scope of PAGE_SCOPES) d.addOption(scope.id, scope.label);
        d.setValue(page.scope.kind).onChange((kind) => {
          page.scope.kind = kind as PageScopeKind;
          this.changed();
          this.draw();
        });
      });
    this.drawScopeFields(contentEl);

    new Setting(contentEl)
      .setName("Own sections")
      .setDesc(
        page.sections
          ? "This page uses the sections below, not the home page's."
          : "This page shows the home page's sections, limited to its notes. Turn this on to give it sections of its own."
      )
      .addToggle((t) => t.setValue(page.sections !== null).onChange((on) => this.setOwn(on)));
    if (page.sections) {
      renderSectionList(contentEl, this.plugin, page.sections, () => this.changed(), () => this.draw());
    }

    new Setting(contentEl).setName("Advanced").setHeading();
    cssClassSetting(contentEl, "page", page.cssClass, (value) => {
      page.cssClass = value;
      this.changed();
    });

    if (this.mode === "create") {
      new Setting(contentEl)
        .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
        .addButton((b) => b.setButtonText("Create page").setCta().onClick(() => this.create()));
    }
  }

  private drawScopeFields(el: HTMLElement): void {
    const { scope } = this.page;
    switch (scope.kind) {
      case "folder":
        new Setting(el)
          .setName("Folder")
          .setDesc(scope.folder || "No folder chosen. Its subfolders count too.")
          .addButton((b) =>
            b.setButtonText(scope.folder ? "Change" : "Choose").onClick(() =>
              pickFolder(this.app, (folder) => {
                scope.folder = folder.path;
                this.changed();
                this.draw();
              })
            )
          );
        break;
      case "tag":
        new Setting(el)
          .setName("Tag")
          .setDesc("Notes with this tag or a tag under it. Leave out the #.")
          .addText((t) =>
            t.setPlaceholder("Tag name").setValue(scope.tag).onChange((value) => {
              scope.tag = value.trim().replace(/^#/, "");
              this.changed();
            })
          );
        break;
      case "property":
        new Setting(el)
          .setName("Property")
          .setDesc("Notes that have this property, and hold this value when one is given.")
          .addText((t) =>
            t.setPlaceholder("Property name").setValue(scope.propertyKey).onChange((value) => {
              scope.propertyKey = value.trim();
              this.changed();
            })
          )
          .addText((t) =>
            t.setPlaceholder("Value (optional)").setValue(scope.propertyValue).onChange((value) => {
              scope.propertyValue = value.trim();
              this.changed();
            })
          );
        break;
      default:
        break;
    }
  }

  /** Give the page its own sections, or return it to the home page's. */
  private setOwn(on: boolean): void {
    const { page, plugin } = this;
    if (on) {
      page.sections = this.stash ?? cloneSections(plugin.settings.sections);
    } else {
      this.stash = page.sections;
      page.sections = null;
    }
    this.changed();
    this.draw();
  }

  private create(): void {
    const { page, plugin } = this;
    // A kind that needs a folder, tag or property has nothing to show without one.
    if (page.scope.kind !== "all" && isScopeBlank(page.scope)) {
      new Notice("Choose what the page is about first.");
      return;
    }
    page.name = uniquePageName(plugin.settings.pages, page.name.trim() || suggestPageName(page.scope));
    plugin.settings.pages.push(page);
    this.created = true;
    this.close();
  }
}
