/**
 * Vault-wide queries: the ones that walk every note's metadata or read a
 * file that is not a note. Each costs O(vault), so callers run them once
 * per compose rather than once per card.
 */

import type { App } from "obsidian";

/** Every frontmatter key in the vault, sorted, for the settings pickers. */
export function discoverProperties(app: App): string[] {
  const keys = new Set<string>();
  for (const file of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) continue;
    for (const k of Object.keys(fm)) if (k !== "position") keys.add(k);
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

/**
 * Inbound link totals per note path, summed from the resolved-links
 * table. One pass over the link graph; no file reads. Notes nobody links
 * to are absent, and callers read absence as zero.
 */
export function inboundCounts(app: App): Map<string, number> {
  const totals = new Map<string, number>();
  const table = app.metadataCache.resolvedLinks ?? {};
  for (const targets of Object.values(table)) {
    for (const [target, n] of Object.entries(targets ?? {})) {
      totals.set(target, (totals.get(target) ?? 0) + n);
    }
  }
  return totals;
}

interface TypifyStyle {
  name?: string;
  icon?: string;
  appliesTo?: string[];
}

/**
 * Typify's icon per note `type`, keyed lowercase. A soft dependency on
 * another plugin's private data file: absent, malformed or reshaped data
 * yields an empty map, and cards fall back to their initial letter.
 */
export async function loadTypifyIcons(app: App): Promise<Map<string, string>> {
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
      if (!(style.appliesTo ?? ["type"]).includes("type")) continue;
      out.set(name.toLowerCase(), icon);
    }
  } catch {
    return new Map();
  }
  return out;
}
