/**
 * Section include-filters, in Notebook Navigator's pattern idiom so the
 * syntax is one an Obsidian user has already met: comma-separated lists,
 * `*` wildcards, bare tag or folder names matching descendants, and
 * `key` / `key=value` frontmatter rules.
 *
 * A note must satisfy every non-empty field (families AND); within a
 * field, patterns OR. Compiled once per section per compose, and pure,
 * so the tests exercise it without Obsidian.
 */

import type { CachedMetadata, TFile } from "obsidian";
import type { SectionConfig } from "../settings/schema";
import { splitList } from "./values";

export type ScopeConfig = Pick<SectionConfig, "filterTags" | "filterProps" | "filterFolders">;
export type ScopeTest = (file: TFile, cache: CachedMetadata | null) => boolean;

/**
 * One `*`-wildcard pattern as a predicate. Every literal character is
 * escaped before the RegExp is built, so user text cannot inject syntax
 * or throw at compile time.
 */
function globToTest(pattern: string): (value: string) => boolean {
  const source = pattern
    .toLowerCase()
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const re = new RegExp(`^${source}$`);
  return (value) => re.test(value.toLowerCase());
}

const anyOf =
  <T>(tests: ((v: T) => boolean)[]) =>
  (v: T): boolean =>
    tests.some((t) => t(v));

/** A bare tag also matches descendants; a wildcard says where it ends. */
function compileTags(raw: string): ((tag: string) => boolean) | null {
  const patterns = splitList(raw).map((p) => p.replace(/^#/, ""));
  if (!patterns.length) return null;
  return anyOf(
    patterns.map((p) => {
      const exact = globToTest(p);
      if (p.includes("*")) return exact;
      const descend = globToTest(`${p}/*`);
      return (tag: string) => exact(tag) || descend(tag);
    })
  );
}

/** With a `/`: the folder path and its subtree. Bare: any path segment. */
function compileFolders(raw: string): ((folder: string) => boolean) | null {
  const patterns = splitList(raw);
  if (!patterns.length) return null;
  return anyOf(
    patterns.map((p) => {
      if (p.includes("/")) {
        const clean = p.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\/\*$/, "");
        const exact = globToTest(clean);
        const descend = globToTest(`${clean}/*`);
        return (folder: string) => exact(folder) || descend(folder);
      }
      const segment = globToTest(p);
      return (folder: string) => folder.split("/").some(segment);
    })
  );
}

interface PropRule {
  key: string;
  /** null: the property must exist and be non-empty. */
  value: string | null;
}

function compileProps(raw: string): ((cache: CachedMetadata | null) => boolean) | null {
  const rules: PropRule[] = splitList(raw).map((entry) => {
    const eq = entry.indexOf("=");
    if (eq === -1) return { key: entry.toLowerCase(), value: null };
    return {
      key: entry.slice(0, eq).trim().toLowerCase(),
      value: entry.slice(eq + 1).trim().toLowerCase(),
    };
  });
  if (!rules.length) return null;
  return (cache) => rules.some((rule) => matchesRule(cache, rule));
}

function matchesRule(cache: CachedMetadata | null, rule: PropRule): boolean {
  const fm = cache?.frontmatter;
  if (!fm) return false;
  // Keys match case-insensitively, as Bases matches them.
  const key = Object.keys(fm).find((k) => k.toLowerCase() === rule.key);
  if (key === undefined) return false;
  const value: unknown = fm[key];
  if (value === null || value === undefined || value === "") return false;
  if (rule.value === null) return true;
  const list: unknown[] = Array.isArray(value) ? value : [value];
  return list.some(
    (v) =>
      (typeof v === "string" || typeof v === "number" || typeof v === "boolean") &&
      String(v).replace(/^#/, "").toLowerCase() === rule.value
  );
}

/** Frontmatter tags then inline tags, without their `#`. */
export function tagsOf(cache: CachedMetadata | null): string[] {
  const out: string[] = [];
  const fm: unknown = cache?.frontmatter?.tags;
  for (const t of Array.isArray(fm) ? fm : fm != null ? [fm] : []) {
    if (typeof t === "string") out.push(t.replace(/^#/, ""));
  }
  for (const t of cache?.tags ?? []) out.push(t.tag.replace(/^#/, ""));
  return out;
}

/** One predicate for a section's filters; null when it has none. */
export function compileScope(scope: ScopeConfig): ScopeTest | null {
  const tags = compileTags(scope.filterTags);
  const props = compileProps(scope.filterProps);
  const folders = compileFolders(scope.filterFolders);
  if (!tags && !props && !folders) return null;

  return (file, cache) => {
    if (tags && !tagsOf(cache).some(tags)) return false;
    if (props && !props(cache)) return false;
    if (folders) {
      const folder = file.parent && file.parent.path !== "/" ? file.parent.path : "";
      if (!folders(folder)) return false;
    }
    return true;
  };
}
