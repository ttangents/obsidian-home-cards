/**
 * LEGACY COMPATIBILITY. Do not copy this pattern.
 *
 * This module reads the Typify plugin's own settings file, a private
 * format Typify does not publish as an API. It predates Home Cards' rule
 * for integrations: another plugin is reached only through an API it
 * documents, or through ordinary vault data both plugins understand. The
 * reader stays because it is opt-in, read-only, and fails to nothing; it
 * stays here, alone, so that it never becomes a precedent. The
 * architecture tests refuse a read of another plugin's files anywhere else.
 *
 * The file is read once and kept: composes and Bases renders take the
 * kept map, and the plugin drops it when settings change or the reader
 * asks to recompose, so an edit in Typify shows after either.
 */

import type { App } from "obsidian";
import type { HomeCardsSettings } from "../settings/schema";

interface TypifyStyle {
  name?: string;
  icon?: string;
  appliesTo?: string[];
}

/**
 * Typify's icon per type value, keyed lowercase, for styles that apply
 * to `typeKey`. Read only while the user has "Icon from Typify" on:
 * absent, malformed or reshaped data yields an empty map, and cards fall
 * back to their initial letter.
 */
async function loadTypifyIcons(app: App, typeKey: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const path = `${app.vault.configDir}/plugins/typify/data.json`;
  try {
    if (!(await app.vault.adapter.exists(path))) return out;
    const parsed = JSON.parse(await app.vault.adapter.read(path)) as {
      statusStyles?: TypifyStyle[];
    };
    for (const style of parsed.statusStyles ?? []) {
      const name = (style.name ?? "").trim();
      const icon = (style.icon ?? "").trim();
      if (!name || !icon) continue;
      if (!(style.appliesTo ?? ["type"]).includes(typeKey)) continue;
      out.set(name.toLowerCase(), icon);
    }
  } catch {
    return new Map();
  }
  return out;
}

const NONE: ReadonlyMap<string, string> = new Map();

/** Typify's icons, read at most once until `clear`. */
export class TypifyIcons {
  private kept: { typeKey: string; icons: Promise<ReadonlyMap<string, string>> } | null = null;

  constructor(private readonly app: App) {}

  /** The icons when the glyph setting asks for Typify's, else none. */
  for(settings: Pick<HomeCardsSettings, "showGlyph" | "typifyIcons" | "typeProperty">): Promise<ReadonlyMap<string, string>> {
    if (!settings.showGlyph || !settings.typifyIcons) return Promise.resolve(NONE);
    const typeKey = settings.typeProperty;
    if (this.kept?.typeKey !== typeKey) this.kept = { typeKey, icons: loadTypifyIcons(this.app, typeKey) };
    return this.kept.icons;
  }

  /** Read the file again next time. */
  clear(): void {
    this.kept = null;
  }
}
