/** The stylesheet the build would write, assembled from styles/. */
export function assembleCss(): string;
/** The tile module's source the build would write, from assets/tiles/. */
export function assembleTiles(): string;
/** Where the tile module goes, from the repository root. */
export const TILES_MODULE: string;
