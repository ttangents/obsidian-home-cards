/**
 * Background images: the custom properties that paint a built-in pattern
 * from the tiles bundled in main.js, and the images a user adds: where
 * they are kept, how one is added or removed, and the properties that
 * paint it.
 *
 * Home Cards writes nothing to the vault. An image goes into a
 * `backgrounds` folder inside the plugin's own folder, which the plugin
 * creates when the first image is added and removes when the last one
 * goes. Each image is decoded and re-encoded as it is added, which caps
 * its size and drops its metadata (camera, location). Settings keep a
 * record of each image; the page paints it from the file's resource URL, so
 * no image sits in memory beyond what the browser itself caches.
 */

import { normalizePath, type App, type DataAdapter, type PluginManifest } from "obsidian";
import { CUSTOM_BACKGROUNDS, newBackgroundId, sniffImage, storedSize } from "../settings/custom-background";
import type { BackgroundFit, CustomBackground } from "../settings/schema";
import { TILES } from "./tiles.generated";

/** An error whose message is fit to show the user as it stands. */
export class BackgroundError extends Error {}

/** What the user chose for an image that is about to be added. */
export interface BackgroundDraft {
  label: string;
  fit: BackgroundFit;
  fade: number;
}

/** The custom properties a custom background sets on the page or a swatch. */
export const BACKGROUND_PROPS = ["--_hc-tile", "--_hc-veil", "--_hc-tile-w"] as const;

/** The custom properties a built-in pattern sets: its light and dark tile. */
export const PATTERN_PROPS = ["--_hc-tile-light", "--_hc-tile-dark"] as const;

/**
 * The properties that paint built-in pattern `id` on the page or a swatch.
 * The stylesheet picks the tile for the theme's mode (styles/10-backgrounds.css),
 * so a switch between light and dark needs no code. Empty for Plain.
 */
export function patternProps(id: string): Record<string, string> {
  const tiles = TILES[id];
  if (!tiles) return {};
  return { "--_hc-tile-light": `url("${tiles.light}")`, "--_hc-tile-dark": `url("${tiles.dark}")` };
}

/**
 * The properties that paint an image: the image, the veil over it and,
 * for a pattern, its stored width. The stylesheet reads all three.
 */
export function backgroundProps(
  url: string,
  bg: Pick<CustomBackground, "fade" | "width">
): Record<string, string> {
  return {
    "--_hc-tile": `url("${url.replace(/["\\]/g, "\\$&")}")`,
    "--_hc-veil": `${bg.fade}%`,
    "--_hc-tile-w": `${bg.width}px`,
  };
}

// ----------------------------------------------------------------- adding

interface StoredImage {
  data: ArrayBuffer;
  width: number;
  extension: "webp" | "png";
}

/** Decode `source`, scale it for `fit`, and encode it for storage. */
async function encode(source: File, fit: BackgroundFit): Promise<StoredImage> {
  if (source.size > CUSTOM_BACKGROUNDS.maxSourceBytes) {
    throw new BackgroundError("That file is larger than 25 MB.");
  }
  // The first bytes name the format; the file's extension is only a hint.
  const head = new Uint8Array(await source.slice(0, 16).arrayBuffer());
  if (!sniffImage(head)) throw new BackgroundError("Use a PNG, JPEG, WebP or GIF image.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    throw new BackgroundError("That image could not be read.");
  }
  try {
    const { minEdge } = CUSTOM_BACKGROUNDS;
    if (bitmap.width < minEdge || bitmap.height < minEdge) {
      throw new BackgroundError("That image is too small to use.");
    }
    const size = storedSize(bitmap.width, bitmap.height, fit);
    const canvas = createEl("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new BackgroundError("This device cannot resize images.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);

    // WebP where the platform encodes it; the browser answers PNG where not.
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    canvas.width = 0;
    if (!blob) throw new BackgroundError("That image could not be converted.");
    return {
      data: await blob.arrayBuffer(),
      width: size.width,
      extension: blob.type === "image/webp" ? "webp" : "png",
    };
  } finally {
    bitmap.close();
  }
}

/**
 * The images a user added, in a `backgrounds` folder inside the plugin's
 * own folder. The folder may not exist yet.
 */
export class BackgroundStore {
  constructor(
    private readonly adapter: DataAdapter,
    /** The folder for stored images, from the vault's root. */
    readonly folder: string
  ) {}

  /** The store for this plugin's folder, wherever the vault keeps its configuration. */
  static forPlugin(app: App, manifest: PluginManifest): BackgroundStore {
    const base = manifest.dir ?? `${app.vault.configDir}/plugins/${manifest.id}`;
    return new BackgroundStore(app.vault.adapter, normalizePath(`${base}/${CUSTOM_BACKGROUNDS.folder}`));
  }

  private path(bg: Pick<CustomBackground, "file">): string {
    return `${this.folder}/${bg.file}`;
  }

  /** The URL a stylesheet can load a stored image from. */
  url(bg: Pick<CustomBackground, "file">): string {
    return this.adapter.getResourcePath(this.path(bg));
  }

  /** Whether the stored image is still on disk (a sync may not have brought it yet). */
  async exists(bg: Pick<CustomBackground, "file">): Promise<boolean> {
    try {
      return await this.adapter.exists(this.path(bg));
    } catch {
      return false;
    }
  }

  /**
   * Store `source` and return its record. `stored` is how many images the
   * settings already hold. Throws a `BackgroundError` for a file that
   * cannot be used. The caller adds the record to settings.
   */
  async add(source: File, draft: BackgroundDraft, stored: number): Promise<CustomBackground> {
    if (stored >= CUSTOM_BACKGROUNDS.max) {
      throw new BackgroundError(`Home Cards keeps up to ${CUSTOM_BACKGROUNDS.max} backgrounds. Remove one to add another.`);
    }
    const image = await encode(source, draft.fit);
    const id = newBackgroundId();
    const bg: CustomBackground = {
      id,
      label: draft.label.trim().slice(0, CUSTOM_BACKGROUNDS.maxLabel) || "Background",
      file: `${id}.${image.extension}`,
      fit: draft.fit,
      width: image.width,
      fade: draft.fade,
    };
    try {
      if (!(await this.adapter.exists(this.folder))) await this.adapter.mkdir(this.folder);
      await this.adapter.writeBinary(this.path(bg), image.data);
    } catch (err) {
      console.error("Home Cards: could not store the background", err);
      throw new BackgroundError("The image could not be saved in the plugin folder.");
    }
    return bg;
  }

  /**
   * Delete a stored image, and the folder once it is empty. A file that
   * will not go is logged and left; the record leaves settings either way.
   */
  async remove(bg: CustomBackground): Promise<void> {
    try {
      const path = this.path(bg);
      if (await this.adapter.exists(path)) await this.adapter.remove(path);
      const left = await this.adapter.list(this.folder);
      if (!left.files.length && !left.folders.length) await this.adapter.rmdir(this.folder, false);
    } catch (err) {
      console.error("Home Cards: could not remove the background file", err);
    }
  }
}

/** Ask the device for one image. Calls back with the file, never with a cancel. */
export function chooseImage(onFile: (file: File) => void): void {
  const input = createEl("input", { type: "file" });
  input.accept = "image/png,image/jpeg,image/webp,image/gif";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) onFile(file);
  });
  input.click();
}
