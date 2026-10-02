/**
 * The settings tab: three panes behind a segmented switch.
 *
 * Every control writes through one of the plugin's two persistence verbs.
 * `touch()` coalesces a burst of keystrokes or slider ticks into one
 * write; `commit()` writes at once, and the pane redraws after it when
 * the change shows or hides other controls.
 */

import { Notice, PluginSettingTab, Setting } from "obsidian";
import type HomeCardsPlugin from "../main";
import { shortcutsSupported } from "../platform/shortcuts";
import { renderBackgroundPicker } from "../render/swatches";
import { isChoice, LIMITS, SURFACES, VIEW_MODES } from "../settings/schema";
import { SectionsPane } from "./sections";
import { addChoices, hint, settingGroup } from "./widgets";

const PANES = [
  { id: "sections", label: "Sections" },
  { id: "cards", label: "Cards" },
  { id: "layout", label: "Layout" },
] as const;
type PaneId = (typeof PANES)[number]["id"];

export class HomeCardsSettingTab extends PluginSettingTab {
  /** Which pane is showing. View state: never persisted. */
  private pane: PaneId = "sections";
  private readonly sections: SectionsPane;

  constructor(private readonly plugin: HomeCardsPlugin) {
    super(plugin.app, plugin);
    this.sections = new SectionsPane(plugin, () => this.display());
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("home-cards-settings");

    const bar = containerEl.createDiv({ cls: "hc-tabs", attr: { role: "tablist" } });
    for (const pane of PANES) {
      const on = pane.id === this.pane;
      const b = bar.createEl("button", {
        text: pane.label,
        attr: { role: "tab", "aria-selected": String(on) },
      });
      b.toggleClass("is-active", on);
      b.addEventListener("click", () => {
        this.pane = pane.id;
        this.display();
      });
    }

    const body = containerEl.createDiv({ cls: "hc-tabbody" });
    switch (this.pane) {
      case "sections":
        this.sections.render(body);
        break;
      case "cards":
        this.cardsPane(body);
        break;
      case "layout":
        this.layoutPane(body);
        break;
    }
  }

  /** Obsidian calls this when the tab closes: write any pending edit. */
  hide(): void {
    this.sections.forget();
    void this.plugin.flush();
  }

  /** Write now, then redraw so dependent controls appear or disappear. */
  private async restructure(): Promise<void> {
    await this.plugin.commit();
    this.display();
  }

  // ------------------------------------------------------------------ cards

  private cardsPane(root: HTMLElement): void {
    const s = this.plugin.settings;
    hint(root, "What each card carries, and where its text comes from.");

    const content = settingGroup(root);
    new Setting(content)
      .setName("Glyph")
      .setDesc("A mark in the corner of each card.")
      .addDropdown((d) =>
        d
          .addOption("off", "None")
          .addOption("letter", "Initial letter")
          .addOption("typify", "Icon from Typify")
          .setValue(!s.showGlyph ? "off" : s.typifyIcons ? "typify" : "letter")
          .onChange((v) => {
            s.showGlyph = v !== "off";
            s.typifyIcons = v === "typify";
            void this.restructure();
          })
      );
    if (s.showGlyph && s.typifyIcons) {
      hint(
        content,
        "Requires the Typify plugin. Home Cards reads Typify's icons and matches them on each note's type. Types without a Typify icon keep the initial letter."
      );
    }

    new Setting(content)
      .setName("Type label")
      .setDesc("The value of this property, shown as the first pill on each card.")
      .addText((t) =>
        t
          .setValue(s.typeProperty)
          .setDisabled(!s.showRubric)
          .onChange((v) => {
            s.typeProperty = v.trim() || "type";
            this.plugin.touch();
          })
      )
      .addToggle((t) =>
        t.setValue(s.showRubric).onChange((v) => {
          s.showRubric = v;
          void this.restructure();
        })
      );

    new Setting(content)
      .setName("Tags")
      .setDesc("Frontmatter tags first, then inline tags.")
      .addToggle((t) =>
        t.setValue(s.showTags).onChange((v) => {
          s.showTags = v;
          void this.restructure();
        })
      )
      .addSlider((sl) =>
        sl
          .setLimits(LIMITS.maxTags.min, LIMITS.maxTags.max, 1)
          .setValue(s.maxTags)
          .setDynamicTooltip()
          .setDisabled(!s.showTags)
          .onChange((v) => {
            s.maxTags = v;
            this.plugin.touch();
          })
      );

    new Setting(content)
      .setName("Opening sentence")
      .setDesc("The first prose sentence, and how many lines it may run to.")
      .addToggle((t) =>
        t.setValue(s.showDeks).onChange((v) => {
          s.showDeks = v;
          void this.restructure();
        })
      )
      .addSlider((sl) =>
        sl
          .setLimits(LIMITS.dekLines.min, LIMITS.dekLines.max, 1)
          .setValue(s.dekLines)
          .setDynamicTooltip()
          .setDisabled(!s.showDeks)
          .onChange((v) => {
            s.dekLines = v;
            this.plugin.touch();
          })
      );

    new Setting(content)
      .setName("File size in the footer")
      .setDesc("The footer always carries the value the section sorts on.")
      .addToggle((t) =>
        t.setValue(s.showFileSize).onChange((v) => {
          s.showFileSize = v;
          this.plugin.touch();
        })
      );

    const text = settingGroup(root, "Text extraction");
    new Setting(text)
      .setName("Summary property")
      .setDesc("When a note defines it, it wins over the first sentence.")
      .addText((t) =>
        t.setValue(s.summaryProperty).onChange((v) => {
          s.summaryProperty = v.trim();
          this.plugin.touch();
        })
      );
    new Setting(text)
      .setName("Skip openings beginning with")
      .setDesc("Comma separated. Self-referential first sentences get passed over.")
      .addTextArea((t) =>
        t.setValue(s.boilerplateOpeners).onChange((v) => {
          s.boilerplateOpeners = v;
          this.plugin.touch();
        })
      );
    new Setting(text)
      .setName("Strip from headlines")
      .setDesc("Comma separated title prefixes. The toggle also strips trailing date stamps.")
      .addText((t) =>
        t.setValue(s.titlePrefixes).onChange((v) => {
          s.titlePrefixes = v;
          this.plugin.touch();
        })
      )
      .addToggle((t) =>
        t
          .setTooltip("Strip trailing dates")
          .setValue(s.stripTrailingDates)
          .onChange((v) => {
            s.stripTrailingDates = v;
            this.plugin.touch();
          })
      );
  }

  // ----------------------------------------------------------------- layout

  private layoutPane(root: HTMLElement): void {
    const s = this.plugin.settings;
    hint(
      root,
      "Color, type and spacing come from your active theme. These settings choose the surface cards sit on and how the grid reflows."
    );

    const page = settingGroup(root);
    new Setting(page).setName("Default view").addDropdown((d) =>
      addChoices(d, VIEW_MODES)
        .setValue(s.defaultView)
        .onChange((v) => {
          if (!isChoice(VIEW_MODES, v)) return;
          s.defaultView = v;
          this.plugin.touch();
        })
    );
    new Setting(page)
      .setName("Minimum card width")
      .setDesc("Cards reflow to fill the pane; this sets how narrow they may get.")
      .addSlider((sl) =>
        sl
          .setLimits(LIMITS.cardMinWidth.min, LIMITS.cardMinWidth.max, 2)
          .setValue(s.cardMinWidth)
          .setDynamicTooltip()
          .onChange((v) => {
            s.cardMinWidth = v;
            this.plugin.touch();
          })
      );
    new Setting(page)
      .setName("Card surface")
      .setDesc(
        "Flat uses the theme's panel color and a thin border. Elevated lifts each card on a shadow. Frosted lets a background pattern show through, blurred."
      )
      .addDropdown((d) =>
        addChoices(d, SURFACES)
          .setValue(s.cardSurface)
          .onChange((v) => {
            if (!isChoice(SURFACES, v)) return;
            s.cardSurface = v;
            this.plugin.touch();
          })
      );
    new Setting(page)
      .setName("Type labels in accent color")
      .setDesc("Off uses the theme's muted text color.")
      .addToggle((t) =>
        t.setValue(s.accentRubrics).onChange((v) => {
          s.accentRubrics = v;
          this.plugin.touch();
        })
      );

    const background = settingGroup(root, "Background");
    new Setting(background)
      .setName("Pattern")
      .setDesc("Plain follows the theme. Each pattern switches between a light and a dark tile with the theme's mode.");
    renderBackgroundPicker(background, this.plugin);

    const header = settingGroup(root, "Header");
    new Setting(header)
      .setName("Greeting")
      .setDesc("Follows the time of day and the calendar, with a word from another language now and then. Add a name to be greeted by it.")
      .addText((t) =>
        t
          .setPlaceholder("Your name")
          .setValue(s.greetingName)
          .setDisabled(!s.greetingEnabled)
          .onChange((v) => {
            s.greetingName = v;
            this.plugin.touch();
          })
      )
      .addToggle((t) =>
        t.setValue(s.greetingEnabled).onChange((v) => {
          s.greetingEnabled = v;
          void this.restructure();
        })
      );
    new Setting(header)
      .setName("Holiday greetings")
      .setDesc("On fixed-date holidays such as New Year's Day and Christmas, the greeting marks the day. Applies the next time you open the home page.")
      .addToggle((t) =>
        t
          .setValue(s.greetingOccasions)
          .setDisabled(!s.greetingEnabled)
          .onChange((v) => {
            s.greetingOccasions = v;
            this.plugin.touch();
          })
      );
    this.appleIntelligence(header);
    new Setting(header).setName("Show note count").addToggle((t) =>
      t.setValue(s.showNoteCount).onChange((v) => {
        s.showNoteCount = v;
        this.plugin.touch();
      })
    );
    new Setting(header).setName("Open on startup").addToggle((t) =>
      t.setValue(s.openOnStartup).onChange((v) => {
        s.openOnStartup = v;
        this.plugin.touch();
      })
    );
  }

  /**
   * Greetings from Apple Intelligence. Offered only where it can run (the
   * desktop app on macOS); elsewhere a note explains why the option is
   * missing, since these settings sync to phones and tablets too.
   */
  private appleIntelligence(group: HTMLElement): void {
    const s = this.plugin.settings;
    const name = "Greetings from Apple Intelligence";
    if (!shortcutsSupported()) {
      new Setting(group)
        .setName(name)
        .setDesc("Available in the Obsidian desktop app on a Mac with Apple Intelligence. This device uses the built-in greetings.");
      return;
    }

    new Setting(group)
      .setName(name)
      .setDesc("Writes a fresh greeting on this Mac with the on-device model. The prompt holds only the date and time, and nothing leaves your Mac. The built-in greetings fill in whenever the model is unavailable.")
      .addToggle((t) =>
        t
          .setValue(s.greetingAI)
          .setDisabled(!s.greetingEnabled)
          .onChange((v) => {
            s.greetingAI = v;
            void this.restructure();
          })
      );
    if (!s.greetingAI || !s.greetingEnabled) return;

    new Setting(group)
      .setName("Shortcut")
      .setDesc("The plugin runs this shortcut to reach the model. Test it once after you build it.")
      .addText((t) =>
        t
          .setPlaceholder("Home Cards Greeting")
          .setValue(s.greetingShortcut)
          .onChange((v) => {
            s.greetingShortcut = v.trim() || "Home Cards Greeting";
            this.plugin.touch();
          })
      )
      .addButton((b) =>
        b.setButtonText("Test").onClick(async () => {
          b.setDisabled(true).setButtonText("Running…");
          try {
            const greeting = await this.plugin.greetings.test();
            new Notice(`Apple Intelligence says: ${greeting.replace("{name}", s.greetingName.trim() || "friend")}`);
          } catch (err) {
            new Notice(`The shortcut did not work. ${err instanceof Error ? err.message : String(err)}`, 10_000);
          } finally {
            b.setDisabled(false).setButtonText("Test");
          }
        })
      );

    const steps = group.createEl("ol", { cls: "hc-steps" });
    for (const step of [
      `In the Shortcuts app, create a shortcut named "${s.greetingShortcut}".`,
      "Add Get Text from Input, with Shortcut Input as its input.",
      "Add Use Model. Choose On-Device, and set its prompt to the Text from the previous step.",
      "Add Stop and Output, and set it to the model's Response.",
    ]) {
      steps.createEl("li", { text: step });
    }
  }
}
