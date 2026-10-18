/**
 * A stand-in for the slice of Obsidian's App the compose layer touches:
 * the metadata cache, markdown file list, cached reads, the resolved-link
 * table and the recent-files list. Only `import type` from obsidian
 * appears here, as in the code under test.
 */

import type { App, CachedMetadata, TFile } from "obsidian";

export interface NoteSpec {
  path: string;
  fm?: Record<string, unknown>;
  /** Inline tags, with or without "#". */
  tags?: string[];
  /** Embedded file links, as the metadata cache lists them. */
  embeds?: string[];
  /** Markdown after the frontmatter; blank lines separate blocks. */
  body?: string;
  ctime?: number;
  mtime?: number;
  size?: number;
}

export interface FakeVault {
  app: App;
  file(path: string): TFile;
  /** Count of vault.cachedRead calls, per path. */
  reads: Map<string, number>;
  /** Replace a note's body and bump its mtime, as an edit would. */
  edit(path: string, body: string): void;
}

function blockType(block: string): string {
  if (block.startsWith("#")) return "heading";
  if (block.startsWith("```")) return "code";
  if (block.startsWith(">")) return "blockquote";
  if (block.startsWith("- ") || block.startsWith("* ")) return "list";
  if (block.startsWith("%%")) return "comment";
  return "paragraph";
}

/** Sections the way the metadata cache reports them: typed byte ranges. */
function sectionsOf(body: string): NonNullable<CachedMetadata["sections"]> {
  const out: NonNullable<CachedMetadata["sections"]> = [];
  const re = /[^\n]+(?:\n[^\n]+)*/g;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    const pos = (offset: number) => ({ line: 0, col: 0, offset });
    out.push({
      type: blockType(m[0]),
      position: { start: pos(m.index), end: pos(m.index + m[0].length) },
    });
  }
  return out;
}

export function fakeVault(
  notes: NoteSpec[],
  opts: {
    links?: Record<string, Record<string, number>>;
    lastOpen?: string[];
    typify?: string;
    /** Non-note files in the vault, by path, for link resolution. */
    attachments?: string[];
  } = {}
): FakeVault {
  const files = new Map<string, TFile>();
  const bodies = new Map<string, string>();
  const caches = new Map<string, CachedMetadata>();
  const reads = new Map<string, number>();

  notes.forEach((n, i) => {
    const slash = n.path.lastIndexOf("/");
    const name = n.path.slice(slash + 1).replace(/\.md$/, "");
    const file = {
      path: n.path,
      name: `${name}.md`,
      basename: name,
      extension: "md",
      parent: { path: slash === -1 ? "/" : n.path.slice(0, slash) },
      stat: { ctime: n.ctime ?? 1000 + i, mtime: n.mtime ?? 1000 + i, size: n.size ?? 2048 },
    } as unknown as TFile;
    files.set(n.path, file);
    const body = n.body ?? "";
    bodies.set(n.path, body);
    caches.set(n.path, {
      frontmatter: n.fm,
      tags: (n.tags ?? []).map((t) => ({
        tag: t.startsWith("#") ? t : `#${t}`,
        position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } },
      })),
      sections: sectionsOf(body),
      embeds: (n.embeds ?? []).map((link) => ({
        link,
        original: `![[${link}]]`,
        position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } },
      })),
    });
  });
  const attachments = (opts.attachments ?? []).map((path) => ({ path, name: path.slice(path.lastIndexOf("/") + 1) }));

  const app = {
    vault: {
      // The default; real vaults may name it differently, which is why
      // the plugin reads it from here rather than assuming it.
      configDir: [".", "obsidian"].join(""),
      getMarkdownFiles: () => [...files.values()],
      getResourcePath: (file: { path: string }) => `app://vault/${file.path}`,
      cachedRead: async (file: TFile) => {
        reads.set(file.path, (reads.get(file.path) ?? 0) + 1);
        const body = bodies.get(file.path);
        if (body === undefined) throw new Error(`no such file: ${file.path}`);
        return body;
      },
      adapter: {
        exists: async (p: string) => opts.typify !== undefined && p.endsWith("typify/data.json"),
        read: async () => opts.typify ?? "",
      },
    },
    metadataCache: {
      getFileCache: (file: TFile) => caches.get(file.path) ?? null,
      // Resolves by exact path, then by file name anywhere, as a shortest-path link would.
      getFirstLinkpathDest: (link: string) =>
        attachments.find((a) => a.path === link) ?? attachments.find((a) => a.name === link) ?? null,
      resolvedLinks: opts.links ?? {},
    },
    workspace: {
      getLastOpenFiles: () => opts.lastOpen ?? [],
    },
  } as unknown as App;

  return {
    app,
    reads,
    file(path) {
      const f = files.get(path);
      if (!f) throw new Error(`fake vault has no ${path}`);
      return f;
    },
    edit(path, body) {
      bodies.set(path, body);
      caches.get(path)!.sections = sectionsOf(body);
      const f = files.get(path)!;
      f.stat.mtime += 1;
    },
  };
}
