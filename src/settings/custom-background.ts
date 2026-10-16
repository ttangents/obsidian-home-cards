/**
 * Rules for the images users add as page backgrounds: the limits, the
 * file checks, and the sizes an image is stored at. Pure, so the tests
 * cover them; the decoding and file writing live in render/backgrounds.ts.
 */

import type { BackgroundFit, CustomBackground, HomeCardsSettings } from "./schema";

/** Every custom background id starts with this; no built-in id does. */
export const CUSTOM_PREFIX = "custom-";

export const CUSTOM_BACKGROUNDS = {
  /** How many images a vault may keep. Each is a few hundred KB at most. */
  max: 12,
  /** Fade a new image starts with: a share of the theme background over it. */
  defaultFade: 75,
  /** A pattern is stored no wider than this, and drawn at half of it. */
  patternWidth: 800,
  /** A picture's longer side is stored no longer than this. */
  pictureEdge: 2400,
  /** Smaller images repeat as noise or blur when stretched. */
  minEdge: 16,
  /** Source files above this are refused before decoding. */
  maxSourceBytes: 25 * 1024 * 1024,
  /** Longest label kept. */
  maxLabel: 40,
  /** Folder inside the plugin's own folder that holds the stored images. */
  folder: "backgrounds",
} as const;

/** Stored files are named by id and extension only, never by a path. */
const STORED_FILE = /^[A-Za-z0-9_-]+\.(webp|png|jpe?g|gif)$/;
const CUSTOM_ID = /^custom-[a-z0-9]+$/;

export const isStoredFileName = (name: string): boolean => STORED_FILE.test(name);
export const isCustomId = (id: string): boolean => CUSTOM_ID.test(id);

export function newBackgroundId(): string {
  return `${CUSTOM_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** The record for the selected background, when it is a custom one. */
export function selectedCustom(
  settings: Pick<HomeCardsSettings, "background" | "customBackgrounds">
): CustomBackground | undefined {
  return settings.customBackgrounds.find((bg) => bg.id === settings.background);
}

/** The formats Home Cards reads. SVG is left out: it can carry script. */
export type ImageFormat = "png" | "jpeg" | "webp" | "gif";

/** Name the image format from a file's first bytes, or null if unsupported. */
export function sniffImage(head: Uint8Array): ImageFormat | null {
  const starts = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "png";
  if (starts(0xff, 0xd8, 0xff)) return "jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "gif";
  // RIFF....WEBP
  if (starts(0x52, 0x49, 0x46, 0x46) && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) {
    return "webp";
  }
  return null;
}

/**
 * The size an image is stored at: never larger than the source, and
 * capped by how the image is used. A pattern is limited by width, a
 * picture by its longer side.
 */
export function storedSize(
  width: number,
  height: number,
  fit: BackgroundFit
): { width: number; height: number } {
  const scale =
    fit === "pattern"
      ? Math.min(1, CUSTOM_BACKGROUNDS.patternWidth / width)
      : Math.min(1, CUSTOM_BACKGROUNDS.pictureEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** A starting label from a file name: no extension, separators as spaces. */
export function labelFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (base || "Background").slice(0, CUSTOM_BACKGROUNDS.maxLabel);
}
