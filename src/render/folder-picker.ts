/**
 * A searchable list of the vault's folders, for the commands and the
 * settings that need the user to name one.
 */

import { FuzzySuggestModal, type App, type TFolder } from "obsidian";

class FolderPicker extends FuzzySuggestModal<TFolder> {
  constructor(
    app: App,
    private readonly folders: readonly TFolder[],
    private readonly onPick: (folder: TFolder) => void
  ) {
    super(app);
    this.setPlaceholder("Choose a folder");
  }

  getItems(): TFolder[] {
    return [...this.folders];
  }

  getItemText(folder: TFolder): string {
    return folder.path;
  }

  onChooseItem(folder: TFolder): void {
    this.onPick(folder);
  }
}

/**
 * Folders a page can be about: every folder but the vault root and those
 * inside a dot-folder (the configuration folder, the trash), minus any
 * path in `exclude`. Sorted by path.
 */
export function pickableFolders(app: App, exclude: ReadonlySet<string> = new Set()): TFolder[] {
  return app.vault
    .getAllFolders(false)
    .filter((f) => !f.path.split("/").some((part) => part.startsWith(".")) && !exclude.has(f.path))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** Open the picker; calls back with the chosen folder. */
export function pickFolder(
  app: App,
  onPick: (folder: TFolder) => void,
  exclude?: ReadonlySet<string>
): void {
  new FolderPicker(app, pickableFolders(app, exclude), onPick).open();
}
