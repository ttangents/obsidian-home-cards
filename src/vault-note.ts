/**
 * Which files Home Cards treats as the vault's notes.
 *
 * Since Obsidian 1.14.4 a Markdown file opened from outside the vault is a
 * `TExternalFile`, a subclass of `TFile`, so `instanceof TFile` and the
 * file's extension no longer tell a vault note from an outside file. The
 * vault itself does: it returns the same object for each of its own paths
 * and never an outside file. Asking it also works on Obsidian 1.13, where
 * `TExternalFile` does not exist and importing it would fail.
 *
 * Pure apart from the one vault lookup; only `import type` from obsidian.
 */

import type { App, TAbstractFile, TFile } from "obsidian";

/** True when `file` is a Markdown note that this vault holds. */
export function isVaultNote(app: App, file: TAbstractFile | null | undefined): file is TFile {
  if (!file || (file as Partial<TFile>).extension !== "md") return false;
  return app.vault.getAbstractFileByPath(file.path) === file;
}
