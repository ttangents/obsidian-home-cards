/**
 * Add an image as a page background, or change one already added.
 *
 * Adding starts from a file the user picked: the modal shows it as it
 * will look, asks what it is for (a repeating pattern or a single picture)
 * and how strongly the theme's background covers it, and stores it only
 * on "Add background". Editing changes the name and the fade of a stored
 * image; its kind stays as it was added, because the image was stored at
 * a size that suits that kind.
 */

import { Modal, Notice, Setting, type App } from "obsidian";
import { BackgroundError, backgroundProps, type BackgroundStore } from "../render/backgrounds";
import type { SettingsAccess } from "../settings/store";
import { CUSTOM_BACKGROUNDS, labelFromFileName } from "../settings/custom-background";
import { BACKGROUND_FITS, LIMITS, type BackgroundFit, type CustomBackground } from "../settings/schema";
import { addChoices } from "./widgets";

export type BackgroundTarget =
  | { kind: "add"; file: File }
  | { kind: "edit"; background: CustomBackground };

export class BackgroundModal extends Modal {
  private label: string;
  private fit: BackgroundFit = "picture";
  private fade: number;
  /** Where the preview loads the image from; revoked when the modal closes. */
  private previewUrl: string;
  private readonly ownsPreviewUrl: boolean;
  /** Width the stored image will have, for a pattern preview. */
  private width = 400;
  private busy = false;
  private preview: HTMLElement | null = null;
  /** Lets a reload from sync proceed once the modal closes; see SettingsStore.hold. */
  private release: (() => void) | null = null;

  constructor(
    app: App,
    private readonly store: SettingsAccess,
    private readonly backgrounds: BackgroundStore,
    private readonly target: BackgroundTarget,
    private readonly onDone: () => void
  ) {
    super(app);
    if (target.kind === "add") {
      this.label = labelFromFileName(target.file.name);
      this.fade = CUSTOM_BACKGROUNDS.defaultFade;
      this.previewUrl = URL.createObjectURL(target.file);
      this.ownsPreviewUrl = true;
    } else {
      this.label = target.background.label;
      this.fit = target.background.fit;
      this.fade = target.background.fade;
      this.width = target.background.width;
      this.previewUrl = backgrounds.url(target.background);
      this.ownsPreviewUrl = false;
    }
  }

  onOpen(): void {
    this.release = this.store.hold();
    this.modalEl.addClass("hc-section-modal");
    this.setTitle(this.target.kind === "add" ? "Add background" : "Edit background");
    const { contentEl } = this;

    this.preview = contentEl.createDiv({ cls: "hc-swatch hc-bg-preview", attr: { "aria-hidden": "true" } });
    this.paintPreview();
    if (this.target.kind === "add") void this.measure(this.target.file);

    new Setting(contentEl).setName("Name").addText((t) =>
      t
        .setValue(this.label)
        .onChange((v) => {
          this.label = v;
          if (this.target.kind === "edit") this.target.background.label = v.trim().slice(0, CUSTOM_BACKGROUNDS.maxLabel) || "Background";
          this.saveEdit();
        })
    );

    if (this.target.kind === "add") {
      new Setting(contentEl)
        .setName("Use as")
        .setDesc("A pattern repeats across the page, like the built-in ones. A picture covers the page once.")
        .addDropdown((d) =>
          addChoices(d, BACKGROUND_FITS)
            .setValue(this.fit)
            .onChange((v) => {
              this.fit = v === "pattern" ? "pattern" : "picture";
              this.paintPreview();
            })
        );
    }

    new Setting(contentEl)
      .setName("Fade")
      .setDesc("How much of your theme's background covers the image. Raise it when text is hard to read.")
      .addSlider((sl) =>
        sl
          .setLimits(LIMITS.fade.min, LIMITS.fade.max, 5)
          .setValue(this.fade)
          .onChange((v) => {
            this.fade = v;
            if (this.target.kind === "edit") this.target.background.fade = v;
            this.paintPreview();
            this.saveEdit();
          })
      );

    if (this.target.kind === "add") {
      new Setting(contentEl).addButton((b) =>
        b
          .setButtonText("Add background")
          .setCta()
          .onClick(() => {
            b.setDisabled(true);
            // The callback returns nothing on purpose: a promise callback
            // that returns an Obsidian component makes the promise follow
            // it, and the page never leaves its microtask loop.
            void this.add().finally(() => {
              b.setDisabled(false);
            });
          })
      );
    }
  }

  onClose(): void {
    if (this.ownsPreviewUrl) URL.revokeObjectURL(this.previewUrl);
    this.contentEl.empty();
    this.onDone();
    this.release?.();
    this.release = null;
  }

  /** Save an edit of a stored image; redraws the open pages. */
  private saveEdit(): void {
    if (this.target.kind === "edit") this.store.touch();
  }

  private paintPreview(): void {
    const el = this.preview;
    if (!el) return;
    el.dataset.pattern = "custom";
    el.dataset.fit = this.fit;
    el.setCssProps(backgroundProps(this.previewUrl, { fade: this.fade, width: this.width }));
  }

  /** Read the picked image's width so a pattern previews at its stored scale. */
  private async measure(file: File): Promise<void> {
    try {
      const bitmap = await createImageBitmap(file);
      this.width = Math.min(bitmap.width, CUSTOM_BACKGROUNDS.patternWidth);
      bitmap.close();
      this.paintPreview();
    } catch {
      // The Add button reports an unreadable file with a proper message.
    }
  }

  private async add(): Promise<void> {
    if (this.target.kind !== "add" || this.busy) return;
    this.busy = true;
    try {
      const bg = await this.backgrounds.add(
        this.target.file,
        { label: this.label, fit: this.fit, fade: this.fade },
        this.store.settings.customBackgrounds.length
      );
      const { settings } = this.store;
      settings.customBackgrounds.push(bg);
      // The reader added it to use it.
      settings.background = bg.id;
      await this.store.commit();
      this.close();
    } catch (err) {
      new Notice(err instanceof BackgroundError ? err.message : "The image could not be added.");
      if (!(err instanceof BackgroundError)) console.error("Home Cards: could not add the background", err);
    } finally {
      this.busy = false;
    }
  }
}
