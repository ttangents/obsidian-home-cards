/**
 * Pagewise, when it is installed: the one thing Home Cards gives it, a toolbar
 * button that opens the current note's Home Cards page. Pagewise is another
 * plugin that shows notes as pages and has a document toolbar other plugins
 * can add to. Home Cards works without it in every respect.
 *
 * Home Cards never reaches into Pagewise. Pagewise hands over its documented
 * toolbar API through public workspace events (see main.ts), and this module
 * checks the shape of what arrives before anything uses it. A Pagewise whose
 * contract version Home Cards does not know counts as absent.
 *
 * Pure: types and checks, no Obsidian runtime.
 */

/** The contract version Home Cards was written against. */
export const PAGEWISE_CONTRACT = 1;

/** Workspace events in Pagewise's contract: the API (or null on unload), and a request for it. */
export const PAGEWISE_EVENTS = {
  api: "pagewise:api",
  request: "pagewise:request",
} as const;

/** What Pagewise passes to a toolbar item's callbacks; Home Cards reads only the file's path and extension. */
export interface PagewiseContext {
  file: { path: string; extension: string } | null;
}

/** The part of a toolbar item Home Cards fills in. */
export interface PagewiseToolbarItem {
  id: string;
  label: string;
  icon: string;
  onClick: (context: PagewiseContext) => void;
  isVisible: (context: PagewiseContext) => boolean;
  readingView: boolean;
}

/** The part of Pagewise's API Home Cards uses. */
export interface PagewiseApi {
  readonly version: number;
  registerToolbarItem(item: PagewiseToolbarItem): () => void;
}

/** The API when `value` is one Home Cards can use, else null. */
export function asPagewiseApi(value: unknown): PagewiseApi | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== PAGEWISE_CONTRACT) return null;
  return typeof v.registerToolbarItem === "function" ? (value as PagewiseApi) : null;
}

/** The toolbar button: opens the note's Home Cards page through `open`. */
export function notePageButton(open: (path: string) => void): PagewiseToolbarItem {
  const isNote = (context: PagewiseContext) => context.file?.extension === "md";
  return {
    id: "home-cards:note-page",
    label: "Open Home Cards page",
    icon: "layout-grid",
    onClick: (context) => {
      if (context.file && isNote(context)) open(context.file.path);
    },
    isVisible: isNote,
    readingView: true,
  };
}
