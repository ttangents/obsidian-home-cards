import assert from "node:assert/strict";
import { test } from "vitest";
import type { App, TAbstractFile } from "obsidian";
import { isVaultNote } from "../src/vault-note";

/** A vault that holds the given files, keyed by path, as Obsidian's does. */
function appWith(...files: TAbstractFile[]): App {
  const byPath = new Map(files.map((f) => [f.path, f]));
  return { vault: { getAbstractFileByPath: (p: string) => byPath.get(p) ?? null } } as unknown as App;
}

function file(path: string): TAbstractFile {
  return { path, extension: path.split(".").pop() } as unknown as TAbstractFile;
}

test("a Markdown note the vault holds counts", () => {
  const note = file("Notes/a.md");
  assert.equal(isVaultNote(appWith(note), note), true);
});

test("a file opened from outside the vault does not count", () => {
  // Obsidian 1.14.4 hands these over as TExternalFile, a TFile the vault does not hold.
  const outside = file("/Users/sam/Desktop/readme.md");
  assert.equal(isVaultNote(appWith(file("Notes/a.md")), outside), false);
});

test("an outside file whose path matches a vault note does not count", () => {
  const inVault = file("readme.md");
  const outside = file("readme.md");
  assert.equal(isVaultNote(appWith(inVault), outside), false);
});

test("other file types and nothing do not count", () => {
  const canvas = file("Board.canvas");
  assert.equal(isVaultNote(appWith(canvas), canvas), false);
  assert.equal(isVaultNote(appWith(), null), false);
  assert.equal(isVaultNote(appWith(), undefined), false);
});
