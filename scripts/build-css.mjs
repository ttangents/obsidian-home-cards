/**
 * Assemble styles.css from styles/*.css, in filename order.
 *
 * Background tiles live as PNGs in assets/tiles/ and are referenced from
 * the partials as `url("@tile:<id>-<mode>@")`. Obsidian loads a plugin's
 * styles.css as one file with no asset path, so each placeholder becomes
 * an inline data URL here.
 *
 * The build fails, and writes nothing, when a placeholder names a missing
 * tile, when a placeholder survives substitution, or when braces do not
 * balance in any partial. Each guard catches a way an edit has broken
 * this file before.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const partialsDir = join(root, "styles");
const tilesDir = join(root, "assets", "tiles");
const PLACEHOLDER = /@tile:([a-z0-9-]+)@/g;

function fail(message) {
  console.error(`build-css: ${message}`);
  process.exit(1);
}

function braceBalance(css) {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"]*"/g, '""');
  let depth = 0;
  for (const ch of bare) {
    if (ch === "{") depth++;
    else if (ch === "}" && --depth < 0) return depth;
  }
  return depth;
}

export function assembleCss() {
  const partials = readdirSync(partialsDir).filter((f) => f.endsWith(".css")).sort();
  if (!partials.length) fail("no partials in styles/");

  let css = "";
  for (const name of partials) {
    const text = readFileSync(join(partialsDir, name), "utf8");
    if (braceBalance(text) !== 0) fail(`${name}: unbalanced braces`);
    css += text;
  }

  const tiles = new Set(readdirSync(tilesDir).filter((f) => f.endsWith(".png")));
  css = css.replace(PLACEHOLDER, (_, id) => {
    const file = `${id}.png`;
    if (!tiles.has(file)) fail(`placeholder names a missing tile: ${file}`);
    return `data:image/png;base64,${readFileSync(join(tilesDir, file)).toString("base64")}`;
  });
  if (css.includes("@tile:")) fail("a malformed @tile placeholder survived substitution");
  return css;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const css = assembleCss();
  writeFileSync(join(root, "styles.css"), css);
  console.log(`build-css: styles.css, ${(css.length / 1024).toFixed(0)} KB`);
}
