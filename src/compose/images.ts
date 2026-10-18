/**
 * Which image a card shows: the first image named by the configured
 * properties, in order, and otherwise the note's first embedded image.
 *
 * Only images in the vault count. A property holding a web address is
 * passed over, because loading it would be a network request, and Home
 * Cards makes none. This module only finds the link; the vault snapshot
 * resolves it through Obsidian (see vault.ts), as a link in a note is
 * resolved, never by building a file path.
 *
 * Pure: no App, no I/O.
 */

import type { CachedMetadata } from "obsidian";
import { propertyValue } from "./conditions";
import { splitList } from "./values";

export const IMAGE_FILE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;

/** Strip a link's alias, size and heading: `a.png|300` → `a.png`. */
const bare = (link: string) => link.split("|")[0].split("#")[0].trim();

/**
 * The vault link in a property value: a wikilink or embed, a Markdown
 * link or image, or a plain path. Null for a web address, another URL
 * scheme, or a file that is not an image.
 */
export function imageLink(raw: unknown): string | null {
  const value: unknown = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  let text = value.trim();
  const wiki = /^!?\[\[([^\]]+)\]\]$/.exec(text);
  const markdown = /^!?\[[^\]]*\]\(<?([^)>]+)>?\)$/.exec(text);
  if (wiki) text = wiki[1];
  else if (markdown) text = markdown[1];
  text = bare(text);
  if (!text || /^[a-z][a-z0-9+.-]*:/i.test(text)) return null;
  try {
    text = decodeURI(text);
  } catch {
    return null;
  }
  return IMAGE_FILE.test(text) ? text : null;
}

/** The link to a note's card image, or null when it names none. */
export function imageLinkFor(cache: CachedMetadata | null, properties: string): string | null {
  for (const key of splitList(properties)) {
    const link = imageLink(propertyValue(cache, key));
    if (link) return link;
  }
  for (const embed of cache?.embeds ?? []) {
    const link = bare(embed.link);
    if (IMAGE_FILE.test(link) && !/^[a-z][a-z0-9+.-]*:/i.test(link)) return link;
  }
  return null;
}
