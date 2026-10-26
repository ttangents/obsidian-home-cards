// The type of tiles.generated.ts, which scripts/build-css.mjs writes from
// assets/tiles/ and Git ignores for its size. TypeScript reads the generated
// file when it exists and this declaration when it does not, so a checkout
// that has not run the build, such as Obsidian's review, still types TILES.

/** Each background pattern's tiles as data URLs, by pattern id. */
export declare const TILES: Readonly<Record<string, { readonly light: string; readonly dark: string }>>;
