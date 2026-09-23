/**
 * Bounded cache over dek extraction.
 *
 * The home view reads a handful of files per compose; a Bases view reads
 * whatever its query returns. Both go through here, so an unchanged file
 * is never read twice.
 *
 * Entries key on path and hold the file's mtime, so an edited note
 * re-reads. The whole cache also keys on the extraction settings
 * (`dekSignature`): change the summary property or the boilerplate list
 * and every entry lapses on its own, without the settings layer knowing
 * this cache exists.
 *
 * Stored values are Promises, so cards for one file that ask together
 * share one read. Eviction is LRU by Map insertion order.
 */

import type { App, TFile } from "obsidian";
import type { HomeCardsSettings } from "../settings/schema";
import { dekSignature, extractDek } from "./text";

export class DekCache {
  private entries = new Map<string, { mtime: number; dek: Promise<string> }>();
  private signature = "";

  constructor(private readonly capacity = 500) {}

  get(app: App, file: TFile, settings: HomeCardsSettings): Promise<string> {
    const signature = dekSignature(settings);
    if (signature !== this.signature) {
      this.entries.clear();
      this.signature = signature;
    }

    const hit = this.entries.get(file.path);
    if (hit && hit.mtime === file.stat.mtime) {
      this.entries.delete(file.path);
      this.entries.set(file.path, hit);
      return hit.dek;
    }

    // A failed read caches as "", never as a rejected Promise.
    const dek = extractDek(app, file, app.metadataCache.getFileCache(file), settings).catch(
      () => ""
    );
    this.entries.set(file.path, { mtime: file.stat.mtime, dek });
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return dek;
  }
}
