/**
 * "Set a property…" from a card's menu: choose a property, then a value,
 * and Obsidian writes it into the note's frontmatter. The value list
 * offers what the vault already uses for that property, and whatever was
 * typed; the last step names the change before it is made.
 *
 * A property whose values are lists gains the value; any other property
 * takes it in place of its current one.
 */

import { FuzzySuggestModal, Notice, SuggestModal, type App, type TFile } from "obsidian";
import { propertyValue } from "../compose/conditions";
import { typedValue } from "../compose/templates";
import { discoverPropertyTypes, discoverValues } from "../compose/vault";
import type { ValueType } from "../settings/schema";

class KeyPicker extends FuzzySuggestModal<string> {
  constructor(
    app: App,
    private readonly keys: string[],
    private readonly onPick: (key: string) => void
  ) {
    super(app);
    this.setPlaceholder("Choose a property");
  }
  getItems(): string[] {
    return this.keys;
  }
  getItemText(key: string): string {
    return key;
  }
  onChooseItem(key: string): void {
    this.onPick(key);
  }
}

class ValuePicker extends SuggestModal<string> {
  constructor(
    app: App,
    key: string,
    private readonly known: string[],
    private readonly onPick: (value: string) => void
  ) {
    super(app);
    this.setPlaceholder(`Value for ${key}`);
  }
  getSuggestions(query: string): string[] {
    const q = query.trim();
    const matches = this.known.filter((v) => v.toLowerCase().includes(q.toLowerCase()));
    return q && !this.known.some((v) => v.toLowerCase() === q.toLowerCase()) ? [q, ...matches] : matches;
  }
  renderSuggestion(value: string, el: HTMLElement): void {
    el.setText(value);
  }
  onChooseSuggestion(value: string): void {
    this.onPick(value);
  }
}

/** Ask for a property and a value, then set it on `file`. */
export function pickProperty(app: App, file: TFile): void {
  const types = discoverPropertyTypes(app);
  new KeyPicker(app, [...types.keys()], (key) => {
    const type: ValueType = types.get(key) ?? "text";
    const known = type === "boolean" ? ["true", "false"] : discoverValues(app, key);
    new ValuePicker(app, key, known, (value) => void setProperty(app, file, key, value, type === "list")).open();
  }).open();
}

/** Write one property through Obsidian, and say what changed. */
export async function setProperty(app: App, file: TFile, key: string, raw: string, addToList: boolean): Promise<void> {
  const value = typedValue(raw);
  const current = propertyValue(app.metadataCache.getFileCache(file), key);
  await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    if (addToList) {
      const list: unknown[] = Array.isArray(fm[key]) ? fm[key] : fm[key] == null ? [] : [fm[key]];
      if (!list.some((v) => String(v) === String(value))) fm[key] = [...list, value];
    } else {
      fm[key] = value;
    }
  });
  const change = addToList ? `Added ${String(value)} to ${key}` : current === undefined ? `Set ${key} to ${String(value)}` : `Changed ${key} to ${String(value)}`;
  new Notice(`${change} on ${file.basename}.`);
}
